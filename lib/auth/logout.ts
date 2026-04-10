import { EnvConfig } from '../handler/config.js'
import type { EnvConfigOptions } from './../handler/config.js'
import { AuthError, AuthErrorCode } from '../handler/error.js'
import { CacheManager, type SessionData } from '../utils/session.js'
import { buildCookieHeader } from '../utils/cookies.js'
import { fetchWithRetry, type FetchOptions } from '../utils/http.js'
import { loadEnv } from './../handler/env.js'
const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64; rv:148.0) Gecko/20100101 Firefox/148.0'
const REQUEST_TIMEOUT_MS = 15_000
const MAX_RETRIES = 3
const INITIAL_RETRY_DELAY_MS = 100
export interface LogoutOptions {
	readonly baseUrl?: string
	readonly cacheDir?: string
	readonly timeoutMs?: number
	readonly sendReferer?: boolean
	readonly sendOrigin?: boolean
}
export class LogoutClient {
	readonly config: EnvConfig
	readonly cacheManager: CacheManager
	private readonly fetchOptions: FetchOptions
	private readonly sendReferer: boolean
	private readonly sendOrigin: boolean
	constructor(options: LogoutOptions = {}) {
		const env = loadEnv()
		const configOptions: EnvConfigOptions = {
			baseUrl: options.baseUrl ?? env.BASE_URL,
		}
		if (env.LOGOUT_PATH !== undefined) {
			configOptions.logoutPath = env.LOGOUT_PATH
		}
		this.config = new EnvConfig(configOptions)
		this.cacheManager = new CacheManager(options.cacheDir)
		this.fetchOptions = {
			timeoutMs: options.timeoutMs ?? REQUEST_TIMEOUT_MS,
			maxRetries: MAX_RETRIES,
			retryDelayMs: INITIAL_RETRY_DELAY_MS,
			headers: {
				'User-Agent': USER_AGENT,
			},
		}
		this.sendReferer = options.sendReferer ?? true
		this.sendOrigin = options.sendOrigin ?? true
	}
	async logout(): Promise<void> {
		const cacheData = await this.loadValidSession()
		await this.executeLogoutRequest(cacheData, cacheData.csrfToken)
	}
	async logoutWithToken(csrfToken: string): Promise<void> {
		const cacheData = await this.loadValidSession()
		await this.executeLogoutRequest(cacheData, csrfToken)
	}
	async clearCache(): Promise<void> {
		await this.cacheManager.clear()
	}
	async loadCache(): Promise<SessionData | null> {
		return this.cacheManager.load()
	}
	get configRef(): EnvConfig {
		return this.config
	}
	private async loadValidSession(): Promise<SessionData> {
		const session = await this.cacheManager.load()
		if (session === null || !session.loggedIn) {
			await this.cacheManager.clear().catch(() => {})
			throw new AuthError('No valid session found', AuthErrorCode.NOT_AUTHENTICATED)
		}
		return session
	}
	private buildHeaders(cacheData: SessionData): Headers {
		const headers = new Headers(this.fetchOptions.headers)
		headers.set('Content-Type', 'application/x-www-form-urlencoded')
		if (this.sendReferer) {
			headers.set('Referer', this.config.fullLogoutUrl)
		}
		if (this.sendOrigin) {
			headers.set('Origin', this.config.baseUrl)
		}
		const cookieMap = new Map<string, string>()
		for (const c of cacheData.cookies) {
			cookieMap.set(c.name, c.value)
		}
		if (cookieMap.size > 0) {
			headers.set('Cookie', buildCookieHeader(cookieMap))
		}
		return headers
	}
	private async executeLogoutRequest(cacheData: SessionData, csrfToken: string): Promise<void> {
		const headers = this.buildHeaders(cacheData)
		const form = new URLSearchParams({ _token: csrfToken })
		const response = await fetchWithRetry(
			this.config.fullLogoutUrl,
			{
				...this.fetchOptions,
				method: 'POST',
				headers,
				body: form.toString(),
			},
			(res) => !res.ok && res.status >= 500,
		)
		const status = response.status
		if (status >= 200 && status < 400) {
			await this.cacheManager.clear().catch(() => {})
			return
		}
		const body = await response.text().catch(() => 'Unknown error')
		const preview = body.split('<')[0]?.trim() ?? body
		switch (status) {
			case 419:
				throw new AuthError('CSRF token expired or invalid', AuthErrorCode.CSRF_EXPIRED)
			case 422:
				throw new AuthError(
					'Validation error (maybe missing _token)',
					AuthErrorCode.VALIDATION_ERROR,
				)
			case 429:
				throw new AuthError(
					'Too many requests, please try later',
					AuthErrorCode.TOO_MANY_REQUESTS,
				)
			default:
				if (status >= 500) {
					throw new AuthError(`Server error (HTTP ${status})`, AuthErrorCode.SERVER_ERROR)
				}
				throw new AuthError(`HTTP ${status}: ${preview}`, AuthErrorCode.LOGOUT_FAILED)
		}
	}
}
