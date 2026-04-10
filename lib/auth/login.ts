import { EnvConfig, type EnvConfigOptions, loadEnv } from '../handler/config.js'
import { AuthError, AuthErrorCode } from '../handler/error.js'
import { CacheManager, type SessionData, type Cookie } from '../utils/session.js'
import { extractCsrfToken } from '../utils/csrf.js'
import { parseCookies, buildCookieHeader, parseSetCookie } from '../utils/cookies.js'
import { fetchWithRetry, type FetchOptions } from '../utils/http.js'
const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64; rv:148.0) Gecko/20100101 Firefox/148.0'
const REQUEST_TIMEOUT_MS = 15_000
const MAX_RETRIES = 3
const INITIAL_RETRY_DELAY_MS = 100
export interface LoginOptions {
	readonly baseUrl?: string
	readonly email?: string
	readonly password?: string
	readonly cacheDir?: string
	readonly maxRetries?: number
	readonly retryDelayMs?: number
	readonly timeoutMs?: number
	readonly sendReferer?: boolean
	readonly sendOrigin?: boolean
}
export class AuthClient {
	readonly config: EnvConfig
	readonly cacheManager: CacheManager
	private readonly fetchOptions: FetchOptions
	private readonly sendReferer: boolean
	private readonly sendOrigin: boolean
	private cookieJar: Map<string, string> = new Map()
	constructor(options: LoginOptions = {}) {
		const env = loadEnv()
		const configOptions: EnvConfigOptions = {
			baseUrl: options.baseUrl ?? env.BASE_URL,
		}
		if (env.LOGIN_PATH !== undefined) {
			configOptions.loginPath = env.LOGIN_PATH
		}
		const email = options.email ?? env.USER_EMAIL
		if (email !== undefined) {
			configOptions.email = email
		}
		const password = options.password ?? env.USER_PASSWORD
		if (password !== undefined) {
			configOptions.password = password
		}
		this.config = new EnvConfig(configOptions)
		this.cacheManager = new CacheManager(options.cacheDir)
		const maxRetries = options.maxRetries ?? MAX_RETRIES
		const retryDelayMs = options.retryDelayMs ?? INITIAL_RETRY_DELAY_MS
		const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS
		this.fetchOptions = {
			timeoutMs,
			maxRetries,
			retryDelayMs,
			headers: {
				'User-Agent': USER_AGENT,
				'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
			},
		}
		this.sendReferer = options.sendReferer ?? true
		this.sendOrigin = options.sendOrigin ?? true
	}
	async login(): Promise<SessionData> {
		this.validateCredentials()
		const csrfToken = await this.fetchCsrfTokenWithRetry()
		const cachedCookies = await this.getCachedCookiesMap()
		const allCookies = new Map([...this.cookieJar, ...cachedCookies])
		const form = new URLSearchParams({
			_token: csrfToken,
			email: this.config.email,
			password: this.config.password,
		})
		const headers = new Headers(this.fetchOptions.headers)
		headers.set('Content-Type', 'application/x-www-form-urlencoded')
		if (this.sendReferer) {
			headers.set('Referer', this.config.fullLoginUrl)
		}
		if (this.sendOrigin) {
			headers.set('Origin', this.config.baseUrl)
		}
		if (allCookies.size > 0) {
			headers.set('Cookie', buildCookieHeader(allCookies))
		}
		const response = await fetchWithRetry(
			this.config.fullLoginUrl,
			{
				...this.fetchOptions,
				method: 'POST',
				headers,
				body: form.toString(),
			},
			(res) => !res.ok && res.status >= 500,
		)
		this.validateLoginResponse(response)
		const responseCookies = parseCookies(response.headers)
		for (const [name, value] of responseCookies) {
			this.cookieJar.set(name, value)
		}
		const session = this.buildCacheData(responseCookies, csrfToken)
		await this.cacheManager.save(session)
		return session
	}
	async getCachedSession(): Promise<SessionData | null> {
		return this.cacheManager.load()
	}
	async hasValidSession(maxAgeMs: number = 3_600_000): Promise<boolean> {
		const session = await this.cacheManager.loadFresh(maxAgeMs)
		return session !== null && session.loggedIn
	}
	async clearSession(): Promise<void> {
		await this.cacheManager.clear()
		this.cookieJar.clear()
	}
	get cacheFilePath(): string {
		return this.cacheManager.cacheFilePath
	}
	get configRef(): EnvConfig {
		return this.config
	}
	private validateCredentials(): void {
		if (!this.config.email?.trim()) {
			throw new AuthError('USER_EMAIL cannot be empty', AuthErrorCode.INVALID_CREDENTIALS)
		}
		if (!this.config.password?.trim()) {
			throw new AuthError('USER_PASSWORD cannot be empty', AuthErrorCode.INVALID_CREDENTIALS)
		}
		if (!this.config.email.includes('@')) {
			console.warn('⚠️ USER_EMAIL does not contain "@", may not be valid')
		}
	}
	private validateLoginResponse(response: Response): void {
		if (response.ok) return
		const status = response.status
		switch (status) {
			case 419:
				throw new AuthError('CSRF token expired or invalid', AuthErrorCode.CSRF_EXPIRED)
			case 422:
				throw new AuthError(
					'Validation error: email/password incorrect',
					AuthErrorCode.VALIDATION_ERROR,
				)
			case 429:
				throw new AuthError(
					'Too many requests, please try later',
					AuthErrorCode.TOO_MANY_REQUESTS,
				)
			default:
				if (status >= 500) {
					throw AuthError.fromResponse(response, AuthErrorCode.SERVER_ERROR)
				}
				throw AuthError.fromResponse(response, AuthErrorCode.LOGIN_FAILED)
		}
	}
	private async fetchCsrfTokenWithRetry(): Promise<string> {
		let lastError: unknown
		const maxRetries = this.fetchOptions.maxRetries ?? MAX_RETRIES
		const retryDelayMs = this.fetchOptions.retryDelayMs ?? INITIAL_RETRY_DELAY_MS
		for (let attempt = 0; attempt < maxRetries; attempt++) {
			try {
				return await this.fetchCsrfToken()
			} catch (err) {
				lastError = err
				if (attempt < maxRetries - 1) {
					const delay = retryDelayMs * 2 ** attempt
					await new Promise<void>((resolve) => setTimeout(resolve, delay))
				}
			}
		}
		throw new AuthError(
			`Failed to fetch CSRF token after ${maxRetries} attempts`,
			AuthErrorCode.CSRF_NOT_FOUND,
			{ cause: lastError },
		)
	}
	private async fetchCsrfToken(): Promise<string> {
		const headers = new Headers(this.fetchOptions.headers)
		if (this.sendReferer) {
			headers.set('Referer', this.config.baseUrl)
		}
		if (this.sendOrigin) {
			headers.set('Origin', this.config.baseUrl)
		}
		const response = await fetchWithRetry(
			this.config.fullLoginUrl,
			{
				...this.fetchOptions,
				method: 'GET',
				headers,
			},
			() => false,
		)
		if (!response.ok) {
			const snippet = (await response.text().catch(() => '')).slice(0, 200)
			throw AuthError.fromResponse(response, AuthErrorCode.CSRF_FETCH_FAILED, {
				context: snippet,
			})
		}
		const setCookies = response.headers.getSetCookie()
		for (const cookieStr of setCookies) {
			const parsed = parseSetCookie(cookieStr)
			if (parsed) {
				this.cookieJar.set(parsed.name, parsed.value)
			}
		}
		const html = await response.text()
		const token = extractCsrfToken(html)
		if (!token) {
			throw new AuthError('CSRF token not found in HTML', AuthErrorCode.CSRF_NOT_FOUND)
		}
		return token
	}
	private async getCachedCookiesMap(): Promise<Map<string, string>> {
		const session = await this.cacheManager.load()
		const map = new Map<string, string>()
		if (session?.cookies) {
			for (const c of session.cookies) {
				map.set(c.name, c.value)
			}
		}
		return map
	}
	private buildCacheData(cookies: Map<string, string>, csrfToken: string): SessionData {
		const hostname = (() => {
			try {
				return new URL(this.config.baseUrl).hostname
			} catch {
				return this.config.baseUrl
			}
		})()
		const cookieList: Cookie[] = []
		for (const [name, value] of cookies) {
			cookieList.push({
				name,
				value,
				domain: hostname,
				path: '/',
				httpOnly: true,
				secure: this.config.baseUrl.startsWith('https'),
			})
		}
		return {
			cookies: cookieList,
			csrfToken,
			loggedIn: true,
			timestamp: Date.now(),
		}
	}
}
