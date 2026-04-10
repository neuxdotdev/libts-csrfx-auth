/**
 * @fileoverview Authentication client for CSRF-protected logout flows.
 *
 * This module provides the `LogoutClient` class which handles the logout process:
 * - Loads a valid session from disk cache
 * - Builds a POST request with the CSRF token to the logout endpoint
 * - Clears the local session cache on success
 * - Supports custom timeouts, retries, and optional Referer/Origin headers
 *
 * @module auth/logout
 * @public
 */

import { EnvConfig } from '../handler/config.js'
import type { EnvConfigOptions } from './../handler/config.js'
import { AuthError, AuthErrorCode } from '../handler/error.js'
import { CacheManager, type SessionData } from '../utils/session.js'
import { buildCookieHeader } from '../utils/cookies.js'
import { fetchWithRetry, type FetchOptions } from '../utils/http.js'
import { loadEnv } from './../handler/env.js'

/** @internal Default User-Agent string (Firefox 148 on Linux). */
const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64; rv:148.0) Gecko/20100101 Firefox/148.0'

/** @internal Default request timeout in milliseconds (15 seconds). */
const REQUEST_TIMEOUT_MS = 15_000

/** @internal Default maximum number of retry attempts. */
const MAX_RETRIES = 3

/** @internal Initial delay before the first retry in milliseconds. */
const INITIAL_RETRY_DELAY_MS = 100

/**
 * Configuration options for the `LogoutClient`.
 *
 * @remarks
 * All fields are optional. If omitted, the client reads from environment
 * variables (`.env` file or `Bun.env`). Explicit constructor options take
 * precedence over environment variables.
 *
 * @public
 * @since 0.1.1
 */
export interface LogoutOptions {
	/**
	 * Override the base URL of the target server.
	 *
	 * @defaultValue Uses `BASE_URL` from environment variables.
	 * @remarks Must be a valid HTTP/HTTPS URL.
	 */
	readonly baseUrl?: string

	/**
	 * Custom directory for session cache.
	 *
	 * @defaultValue `~/.cache/libts-csrfx-auth`
	 * @remarks The directory will be created automatically if it does not exist.
	 */
	readonly cacheDir?: string

	/**
	 * Request timeout in milliseconds.
	 *
	 * @defaultValue `15000` (15 seconds)
	 */
	readonly timeoutMs?: number

	/**
	 * Whether to send the `Referer` header in the logout request.
	 *
	 * @defaultValue `true`
	 * @remarks Some servers require a `Referer` header for CSRF protection.
	 */
	readonly sendReferer?: boolean

	/**
	 * Whether to send the `Origin` header in the logout request.
	 *
	 * @defaultValue `true`
	 * @remarks Some servers require an `Origin` header for CORS or CSRF validation.
	 */
	readonly sendOrigin?: boolean
}

/**
 * Client for logging out of a CSRF‑protected web application.
 *
 * @remarks
 * The client loads a previously cached session (from {@link AuthClient}), extracts
 * the cookies and CSRF token, and sends a POST request to the logout endpoint.
 * If the logout request succeeds (HTTP 2xx or 3xx), the local session cache is
 * deleted. Any server error or invalid response throws an appropriate {@link AuthError}.
 *
 * The client is configurable via environment variables (`.env` file) or constructor
 * options. It supports retries with exponential backoff and optional
 * `Referer`/`Origin` headers.
 *
 * **Important:** A valid session must have been created by {@link AuthClient}
 * and cached to disk before using `LogoutClient`. Use {@link hasValidSession}
 * from `AuthClient` to verify.
 *
 * @example
 * // Basic usage
 * const logout = new LogoutClient();
 * await logout.logout(); // uses cached session
 *
 * @example
 * // Override base URL and disable Referer header
 * const logout = new LogoutClient({
 *   baseUrl: 'https://example.com',
 *   sendReferer: false
 * });
 * await logout.logout();
 *
 * @example
 * // Explicit CSRF token (if needed)
 * await logout.logoutWithToken('custom_csrf_token');
 *
 * @public
 * @since 0.1.1
 * @see {@link AuthClient} For creating the session.
 * @see {@link CacheManager} For disk caching details.
 */
export class LogoutClient {
	/**
	 * Validated configuration object (base URL, paths).
	 *
	 * @remarks
	 * Contains normalized and validated values from environment variables
	 * and constructor overrides. Read‑only after construction.
	 */
	readonly config: EnvConfig

	/**
	 * Disk cache manager for reading the session.
	 *
	 * @remarks
	 * Handles loading session data from the file system. The cache file path
	 * can be obtained via {@link CacheManager.cacheFilePath}.
	 */
	readonly cacheManager: CacheManager

	/** @internal Internal fetch options (timeout, retries, headers). */
	private readonly fetchOptions: FetchOptions

	/** @internal Whether to send the `Referer` header. */
	private readonly sendReferer: boolean

	/** @internal Whether to send the `Origin` header. */
	private readonly sendOrigin: boolean

	/**
	 * Creates a new LogoutClient instance.
	 *
	 * @param options - Optional overrides for environment‑based configuration.
	 *
	 * @remarks
	 * Configuration is resolved from constructor options first, then from environment
	 * variables (`.env` file or `Bun.env`). The client expects a valid session
	 * to have been previously saved by {@link AuthClient}.
	 *
	 * @example
	 * // Using environment variables only
	 * const logout = new LogoutClient();
	 *
	 * @example
	 * // Custom cache directory and timeout
	 * const logout = new LogoutClient({
	 *   cacheDir: './my-cache',
	 *   timeoutMs: 30000
	 * });
	 */
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

	/**
	 * Performs the logout using the CSRF token stored in the cached session.
	 *
	 * @throws {AuthError} With code `NOT_AUTHENTICATED` if no valid session exists in cache.
	 * @throws {AuthError} With code `CSRF_EXPIRED` on HTTP 419.
	 * @throws {AuthError} With code `VALIDATION_ERROR` on HTTP 422.
	 * @throws {AuthError} With code `TOO_MANY_REQUESTS` on HTTP 429.
	 * @throws {AuthError} With code `SERVER_ERROR` on HTTP 5xx.
	 * @throws {AuthError} With code `LOGOUT_FAILED` for other non‑2xx responses.
	 *
	 * @remarks
	 * **Steps:**
	 * - Loads the session from disk cache (throws `NOT_AUTHENTICATED` if missing/invalid).
	 * - Sends a POST request to the logout endpoint with `_token` and cookies.
	 * - On success (HTTP 2xx/3xx), deletes the local session cache.
	 * - On failure, throws an appropriate {@link AuthError}.
	 *
	 * The request uses retries with exponential backoff for transient failures
	 * (HTTP 5xx and network errors).
	 *
	 * @example
	 * await logout.logout();
	 *
	 * @see {@link logoutWithToken} For using a custom CSRF token.
	 * @see {@link clearCache} To remove the cache without a server request.
	 */
	async logout(): Promise<void> {
		const cacheData = await this.loadValidSession()
		await this.executeLogoutRequest(cacheData, cacheData.csrfToken)
	}

	/**
	 * Performs the logout using an explicitly provided CSRF token.
	 *
	 * @param csrfToken - The CSRF token to send in the logout request.
	 * @throws Same as {@link logout}.
	 *
	 * @remarks
	 * This method is useful when the cached token may be outdated or when the
	 * caller has a more recent token (e.g., after refreshing the CSRF token).
	 * The session cookies are still loaded from the cache; only the token is overridden.
	 *
	 * @example
	 * const freshToken = await someMethodToRefreshToken();
	 * await logout.logoutWithToken(freshToken);
	 *
	 * @see {@link logout}
	 */
	async logoutWithToken(csrfToken: string): Promise<void> {
		const cacheData = await this.loadValidSession()
		await this.executeLogoutRequest(cacheData, csrfToken)
	}

	/**
	 * Clears the local session cache without sending a logout request.
	 *
	 * @remarks
	 * Use this method if you want to discard the cached session without
	 * notifying the server (e.g., for testing or manual cleanup).
	 * This does **not** invalidate the session on the server side.
	 *
	 * @example
	 * await logout.clearCache();
	 */
	async clearCache(): Promise<void> {
		await this.cacheManager.clear()
	}

	/**
	 * Loads the cached session from disk without validation.
	 *
	 * @returns The stored session, or `null` if none exists.
	 *
	 * @remarks
	 * This method does **not** check the `loggedIn` flag or session freshness.
	 * Use {@link AuthClient.hasValidSession} for validity checks.
	 *
	 * @example
	 * const session = await logout.loadCache();
	 * if (session) console.log('Session exists, token:', session.csrfToken);
	 */
	async loadCache(): Promise<SessionData | null> {
		return this.cacheManager.load()
	}

	/**
	 * Returns the internal `EnvConfig` instance for advanced inspection.
	 *
	 * @remarks
	 * Provides access to the normalized configuration, including base URL
	 * and logout path.
	 */
	get configRef(): EnvConfig {
		return this.config
	}

	/**
	 * Loads the cached session and ensures it exists and is logged in.
	 *
	 * @returns The validated session data.
	 * @throws {AuthError} With code `NOT_AUTHENTICATED` if session is missing or `loggedIn` is false.
	 * @internal
	 */
	private async loadValidSession(): Promise<SessionData> {
		const session = await this.cacheManager.load()
		if (session === null || !session.loggedIn) {
			await this.cacheManager.clear().catch(() => {})
			throw new AuthError('No valid session found', AuthErrorCode.NOT_AUTHENTICATED)
		}
		return session
	}

	/**
	 * Builds the HTTP headers for the logout request.
	 *
	 * @param cacheData - The session data containing cookies.
	 * @returns A `Headers` object ready to be used in `fetch`.
	 * @internal
	 */
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

	/**
	 * Executes the POST logout request and handles the response.
	 *
	 * @param cacheData - The session data (used for cookies, not the token).
	 * @param csrfToken - The CSRF token to send (may be from cache or overridden).
	 * @throws {AuthError} For HTTP 419 (CSRF expired), 422 (validation error),
	 *                     429 (rate limit), 5xx (server error), or other failures.
	 * @internal
	 */
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
