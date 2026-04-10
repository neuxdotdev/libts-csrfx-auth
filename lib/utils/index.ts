/**
 * @fileoverview Central export point for all utility modules.
 *
 * Re‑exports everything from `cookies`, `csrf`, `http`, and `session`.
 * Consumers should import from this index for convenience.
 *
 * @module utils/index
 * @public
 */

/**
 * Extracts a CSRF token from an HTML string.
 *
 * @remarks
 * Searches for `<input name="_token" value="...">` or `<meta name="csrf-token" content="...">` patterns.
 *
 * @see {@link extractCsrfToken} for full documentation.
 * @since 0.1.1
 * @public
 */
export { extractCsrfToken } from './csrf.js'

/**
 * Utilities for parsing and serializing HTTP cookies.
 *
 * @remarks
 * Includes:
 * - {@link parseCookies}: Extract cookies from `Set-Cookie` headers.
 * - {@link buildCookieHeader}: Build `Cookie` header string from a cookie map.
 * - {@link parseSetCookie}: Parse a raw `Set-Cookie` header into name and value.
 *
 * @see {@link parseCookies}
 * @see {@link buildCookieHeader}
 * @see {@link parseSetCookie}
 * @since 0.1.1
 * @public
 */
export { parseCookies, buildCookieHeader, parseSetCookie } from './cookies.js'

/**
 * HTTP client with retry and timeout support.
 *
 * @remarks
 * Provides a `fetch` wrapper that automatically retries failed requests with exponential backoff.
 *
 * @see {@link fetchWithRetry}
 * @see {@link FetchOptions}
 * @since 0.1.1
 * @public
 */
export { fetchWithRetry, type FetchOptions } from './http.js'

/**
 * Persistent session storage on the file system.
 *
 * @remarks
 * Manages caching of session data (cookies, CSRF token, login state) to disk,
 * allowing reuse of authenticated sessions across process restarts.
 *
 * @see {@link CacheManager}
 * @see {@link Cookie}
 * @see {@link SessionData}
 * @see {@link isSessionFresh}
 * @see {@link sessionWithCsrfToken}
 * @since 0.1.1
 * @public
 */
export {
	/**
	 * Manages reading, writing, and deleting session cache on disk.
	 *
	 * @see {@link CacheManager}
	 */
	CacheManager,

	/**
	 * Represents a single HTTP cookie with common attributes.
	 *
	 * @see {@link Cookie}
	 */
	type Cookie,

	/**
	 * Complete session data stored in the cache.
	 *
	 * @see {@link SessionData}
	 */
	type SessionData,

	/**
	 * Checks if a cached session is still fresh based on its age.
	 *
	 * @see {@link isSessionFresh}
	 */
	isSessionFresh,

	/**
	 * Creates a new SessionData object with an updated CSRF token.
	 *
	 * @see {@link sessionWithCsrfToken}
	 */
	sessionWithCsrfToken,
} from './session.js'
