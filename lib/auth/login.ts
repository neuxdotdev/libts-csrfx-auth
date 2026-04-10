/**
 * @fileoverview Authentication client for CSRF-protected login flows.
 *
 * This module provides the `AuthClient` class which handles the complete login process:
 * - Fetches a CSRF token from the login page (GET request)
 * - Submits credentials with the token (POST request)
 * - Persists session data (cookies, token) to disk cache
 * - Supports retries, timeouts, and custom HTTP headers
 *
 * @module auth/login
 * @public
 */

import { EnvConfig, type EnvConfigOptions, loadEnv } from '../handler/config.js'
import { AuthError, AuthErrorCode } from '../handler/error.js'
import { CacheManager, type SessionData, type Cookie } from '../utils/session.js'
import { extractCsrfToken } from '../utils/csrf.js'
import { parseCookies, buildCookieHeader, parseSetCookie } from '../utils/cookies.js'
import { fetchWithRetry, type FetchOptions } from '../utils/http.js'

/** @internal Default User-Agent string (Firefox 148 on Linux). */
const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64; rv:148.0) Gecko/20100101 Firefox/148.0'

/** @internal Default request timeout in milliseconds (15 seconds). */
const REQUEST_TIMEOUT_MS = 15_000

/** @internal Default maximum number of retry attempts. */
const MAX_RETRIES = 3

/** @internal Initial delay before the first retry in milliseconds. */
const INITIAL_RETRY_DELAY_MS = 100

/**
 * Configuration options for the `AuthClient`.
 *
 * @remarks
 * All fields are optional. If omitted, the client reads from environment
 * variables (`.env` file or `Bun.env`). Explicit constructor options take
 * precedence over environment variables.
 *
 * @public
 * @since 0.1.1
 */
export interface LoginOptions {
	/**
	 * Override the base URL of the target server.
	 *
	 * @defaultValue Uses `BASE_URL` from environment variables.
	 * @remarks Must be a valid HTTP/HTTPS URL.
	 */
	readonly baseUrl?: string

	/**
	 * Override the user email.
	 *
	 * @defaultValue Uses `USER_EMAIL` from environment variables.
	 * @remarks If provided, must be a valid email format.
	 */
	readonly email?: string

	/**
	 * Override the user password.
	 *
	 * @defaultValue Uses `USER_PASSWORD` from environment variables.
	 * @remarks Cannot be an empty string if provided.
	 */
	readonly password?: string

	/**
	 * Custom directory for session cache.
	 *
	 * @defaultValue `~/.cache/libts-csrfx-auth`
	 * @remarks The directory will be created automatically if it does not exist.
	 */
	readonly cacheDir?: string

	/**
	 * Maximum number of retry attempts for HTTP requests.
	 *
	 * @defaultValue `3`
	 * @remarks Total attempts = `maxRetries + 1`.
	 */
	readonly maxRetries?: number

	/**
	 * Initial retry delay in milliseconds (doubles each retry).
	 *
	 * @defaultValue `100`
	 * @example With default: 100ms, 200ms, 400ms.
	 */
	readonly retryDelayMs?: number

	/**
	 * Request timeout in milliseconds.
	 *
	 * @defaultValue `15000` (15 seconds)
	 */
	readonly timeoutMs?: number

	/**
	 * Whether to send the `Referer` header in requests.
	 *
	 * @defaultValue `true`
	 * @remarks Some servers require a `Referer` header for CSRF protection.
	 */
	readonly sendReferer?: boolean

	/**
	 * Whether to send the `Origin` header in requests.
	 *
	 * @defaultValue `true`
	 * @remarks Some servers require an `Origin` header for CORS or CSRF validation.
	 */
	readonly sendOrigin?: boolean
}

/**
 * Client for automating login against CSRF‑protected web applications.
 *
 * @remarks
 * The client performs a two‑step login process:
 * 1. **GET** the login page to extract a CSRF token and capture any initial cookies.
 * 2. **POST** the credentials together with the CSRF token to authenticate.
 *
 * After successful login, the session (cookies, CSRF token, timestamp) is saved
 * to disk. Subsequent calls can reuse the cached session without re‑authenticating.
 *
 * The client is configurable via environment variables (`.env` file) or constructor
 * options. It supports retries with exponential backoff, timeouts, and optional
 * `Referer`/`Origin` headers for servers that require them.
 *
 * **Session caching:**
 * - Cache location: `~/.cache/libts-csrfx-auth/session.json` (configurable)
 * - Session freshness: 1 hour by default (see {@link hasValidSession})
 * - Use {@link clearSession} to remove cached credentials.
 *
 * @example
 * // Basic usage with environment variables
 * const auth = new AuthClient();
 * const session = await auth.login();
 * console.log('Logged in, CSRF token:', session.csrfToken);
 *
 * @example
 * // Override credentials and use custom cache directory
 * const auth = new AuthClient({
 *   email: 'user@example.com',
 *   password: 'secret',
 *   cacheDir: './my-cache'
 * });
 *
 * @example
 * // Check cached session before logging in
 * if (await auth.hasValidSession()) {
 *   const session = await auth.getCachedSession();
 *   // use session...
 * } else {
 *   await auth.login();
 * }
 *
 * @public
 * @since 0.1.1
 * @see {@link LogoutClient} For terminating the session.
 * @see {@link EnvConfig} For configuration validation.
 * @see {@link CacheManager} For disk caching details.
 */
export class AuthClient {
	/**
	 * Validated configuration object (base URL, paths, credentials).
	 *
	 * @remarks
	 * Contains normalized and validated values from environment variables
	 * and constructor overrides. Read‑only after construction.
	 */
	readonly config: EnvConfig

	/**
	 * Disk cache manager for persisting session data.
	 *
	 * @remarks
	 * Handles saving, loading, and clearing session data from the file system.
	 * The cache file path can be obtained via {@link cacheFilePath}.
	 */
	readonly cacheManager: CacheManager

	/** @internal Internal fetch options (timeout, retries, headers). */
	private readonly fetchOptions: FetchOptions

	/** @internal Whether to send the `Referer` header. */
	private readonly sendReferer: boolean

	/** @internal Whether to send the `Origin` header. */
	private readonly sendOrigin: boolean

	/** @internal In‑memory cookie jar for the current session (accumulated from responses). */
	private cookieJar: Map<string, string> = new Map()

	/**
	 * Creates a new AuthClient instance.
	 *
	 * @param options - Optional overrides for environment‑based configuration.
	 *
	 * @remarks
	 * Configuration is resolved from constructor options first, then from environment
	 * variables (`.env` file or `Bun.env`). The client is ready to use immediately.
	 * No network requests are performed during construction.
	 *
	 * @example
	 * // Using environment variables only
	 * const auth = new AuthClient();
	 *
	 * @example
	 * // Overriding email and password
	 * const auth = new AuthClient({
	 *   email: 'custom@example.com',
	 *   password: 'override123'
	 * });
	 */
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

	/**
	 * Performs the complete login flow and returns the session data.
	 *
	 * @returns The persisted session data (cookies, CSRF token, login flag, timestamp).
	 *
	 * @throws {AuthError} With code `INVALID_CREDENTIALS` if email or password is missing.
	 * @throws {AuthError} With code `CSRF_NOT_FOUND` if CSRF token cannot be extracted.
	 * @throws {AuthError} With code `CSRF_FETCH_FAILED` if the login page request fails.
	 * @throws {AuthError} With code `CSRF_EXPIRED` on HTTP 419.
	 * @throws {AuthError} With code `VALIDATION_ERROR` on HTTP 422 (invalid credentials).
	 * @throws {AuthError} With code `TOO_MANY_REQUESTS` on HTTP 429.
	 * @throws {AuthError} With code `SERVER_ERROR` on HTTP 5xx.
	 * @throws {AuthError} With code `LOGIN_FAILED` for other non‑2xx responses.
	 *
	 * @remarks
	 * **Steps:**
	 * - Validates that credentials are present (throws `INVALID_CREDENTIALS` if missing).
	 * - Fetches the login page (GET) to obtain a CSRF token and any initial cookies.
	 * - Builds a POST request with `_token`, `email`, and `password`.
	 * - Submits the request with cookies from both the cookie jar and cached session.
	 * - Validates the response (throws appropriate `AuthError` on failure).
	 * - Saves the resulting session (cookies, token) to disk cache.
	 *
	 * The method uses retries with exponential backoff for transient failures.
	 *
	 * @example
	 * const session = await auth.login();
	 * console.log(`Logged in at ${new Date(session.timestamp)}`);
	 * console.log(`CSRF token: ${session.csrfToken}`);
	 *
	 * @see {@link hasValidSession} To check for a cached session before logging in.
	 * @see {@link clearSession} To clear the session cache.
	 */
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

	/**
	 * Retrieves the cached session from disk without checking freshness.
	 *
	 * @returns The stored session, or `null` if no session exists or the file is corrupted.
	 *
	 * @remarks
	 * This method does **not** validate the age of the session or the `loggedIn` flag.
	 * Use {@link hasValidSession} for freshness and validity checks.
	 *
	 * @example
	 * const session = await auth.getCachedSession();
	 * if (session) console.log('Session exists, timestamp:', session.timestamp);
	 *
	 * @see {@link hasValidSession}
	 * @see {@link CacheManager.load}
	 */
	async getCachedSession(): Promise<SessionData | null> {
		return this.cacheManager.load()
	}

	/**
	 * Checks whether a valid (fresh and logged‑in) session exists in the cache.
	 *
	 * @param maxAgeMs - Maximum allowed age in milliseconds.
	 * @returns `true` if a cached session exists, is fresh, and `loggedIn` is `true`.
	 *
	 * @defaultValue maxAgeMs = 3_600_000 (1 hour)
	 *
	 * @remarks
	 * A session is considered valid if:
	 * - It exists on disk.
	 * - Its `loggedIn` property is `true`.
	 * - Its age (`Date.now() - session.timestamp`) is less than `maxAgeMs`.
	 *
	 * This method does **not** contact the server to verify the session.
	 *
	 * @example
	 * if (await auth.hasValidSession()) {
	 *   // reuse session without logging in again
	 *   const session = await auth.getCachedSession();
	 * } else {
	 *   await auth.login();
	 * }
	 *
	 * @see {@link getCachedSession}
	 * @see {@link CacheManager.loadFresh}
	 */
	async hasValidSession(maxAgeMs: number = 3_600_000): Promise<boolean> {
		const session = await this.cacheManager.loadFresh(maxAgeMs)
		return session !== null && session.loggedIn
	}

	/**
	 * Clears both the in‑memory cookie jar and the persistent session cache.
	 *
	 * @remarks
	 * Use this method to completely remove any stored authentication state.
	 * After clearing, the next call to {@link login} will start a fresh login flow.
	 *
	 * @example
	 * await auth.clearSession();
	 * // The next call to `login()` will start fresh.
	 */
	async clearSession(): Promise<void> {
		await this.cacheManager.clear()
		this.cookieJar.clear()
	}

	/**
	 * Returns the filesystem path where the session cache is stored.
	 *
	 * @remarks
	 * Useful for debugging or manual inspection. Example:
	 * `"/home/user/.cache/libts-csrfx-auth/session.json"`
	 */
	get cacheFilePath(): string {
		return this.cacheManager.cacheFilePath
	}

	/**
	 * Returns the internal `EnvConfig` instance for advanced inspection.
	 *
	 * @remarks
	 * Provides access to the normalized configuration, including base URL,
	 * login path, email, and password (if set).
	 */
	get configRef(): EnvConfig {
		return this.config
	}

	/**
	 * Validates that email and password are non‑empty.
	 *
	 * @throws {AuthError} With code `INVALID_CREDENTIALS` if either field is empty.
	 * @remarks Warns via `console.warn` if the email does not contain an '@' character.
	 * @internal
	 */
	private validateCredentials(): void {
		if (!this.config.email?.trim()) {
			throw new AuthError('USER_EMAIL cannot be empty', AuthErrorCode.INVALID_CREDENTIALS)
		}
		if (!this.config.password?.trim()) {
			throw new AuthError('USER_PASSWORD cannot be empty', AuthErrorCode.INVALID_CREDENTIALS)
		}
		if (!this.config.email.includes('@')) {
			console.warn('️ USER_EMAIL does not contain "@", may not be valid')
		}
	}

	/**
	 * Inspects the login response and throws appropriate errors for non‑2xx statuses.
	 *
	 * @param response - The HTTP response from the login POST request.
	 * @throws {AuthError} For HTTP 419 (CSRF expired), 422 (validation error),
	 *                     429 (rate limit), 5xx (server error), or other failures.
	 * @internal
	 */
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

	/**
	 * Fetches the CSRF token with retry logic.
	 *
	 * @returns The extracted CSRF token.
	 * @throws {AuthError} After all retries fail, with code `CSRF_NOT_FOUND`.
	 * @internal
	 */
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

	/**
	 * Fetches the login page (GET) and extracts the CSRF token.
	 *
	 * @returns The extracted CSRF token.
	 * @throws {AuthError} If the HTTP request fails, response is not OK,
	 *                     or the token cannot be found in the HTML.
	 * @remarks
	 * Also captures any `Set-Cookie` headers from the response and stores them
	 * in the cookie jar for the subsequent POST request.
	 * @internal
	 */
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

	/**
	 * Loads cookies from the cached session (if any) into a new Map.
	 *
	 * @returns A Map of cookie names to values from the disk cache.
	 * @internal
	 */
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

	/**
	 * Constructs a `SessionData` object from collected cookies and the CSRF token.
	 *
	 * @param cookies - Map of cookie name‑value pairs from the login response.
	 * @param csrfToken - The CSRF token used for the login.
	 * @returns A session object ready for caching.
	 * @remarks
	 * The domain is extracted from the base URL (hostname). Cookies are marked as
	 * `httpOnly: true` and `secure: true` if the base URL uses HTTPS.
	 * @internal
	 */
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
