/**
 * @fileoverview Main entry point for the libts-csrfx-auth library.
 *
 * This module provides a complete CSRF‑protected authentication solution for
 * web scraping, testing, and automation. It includes:
 *
 * - **AuthClient**: Two‑step login (GET for CSRF token, POST with credentials)
 * - **LogoutClient**: Session termination with CSRF token
 * - **CacheManager**: Persistent session storage on disk
 * - **Error handling**: Typed `AuthError` with retry and authentication helpers
 * - **Utilities**: Cookie parsing, CSRF extraction, HTTP retries, session helpers
 *
 * The library reads configuration from a `.env` file (or environment variables)
 * and automatically caches sessions in `~/.cache/libts-csrfx-auth/session.json`.
 *
 * @example
 * // Basic login with environment variables
 * import { AuthClient } from 'libts-csrfx-auth';
 *
 * const auth = new AuthClient();
 * const session = await auth.login();
 * console.log('Logged in, CSRF token:', session.csrfToken);
 *
 * @example
 * // Check cached session before logging in
 * if (await auth.hasValidSession()) {
 *   const session = await auth.getCachedSession();
 *   // reuse session...
 * } else {
 *   await auth.login();
 * }
 *
 * @example
 * // Logout
 * import { LogoutClient } from 'libts-csrfx-auth';
 *
 * const logout = new LogoutClient();
 * await logout.logout();
 *
 * @packageDocumentation
 * @module libts-csrfx-auth
 * @public
 */

import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// Dynamically read package.json to obtain version and name
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const pkgPath = join(__dirname, '..', 'package.json')
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as {
	name: string
	version: string
}

/**
 * The current version of the library, extracted from `package.json`.
 *
 * @remarks
 * This value is read synchronously from `package.json` at module load time.
 * It reflects the exact version installed.
 *
 * @example
 * console.log(VERSION); // "0.1.1"
 *
 * @public
 * @since 0.1.1
 * @see {@link NAME}
 * @see {@link buildInfo}
 */
export const VERSION = pkg.version

/**
 * The package name, extracted from `package.json`.
 *
 * @remarks
 * This value is read synchronously from `package.json` at module load time.
 *
 * @example
 * console.log(NAME); // "libts-csrfx-auth"
 *
 * @public
 * @since 0.1.1
 * @see {@link VERSION}
 * @see {@link buildInfo}
 */
export const NAME = pkg.name

// Re-export authentication clients
/**
 * The main authentication client for CSRF‑protected login flows.
 *
 * @remarks
 * Handles two‑step login: GET for CSRF token, POST with credentials.
 * Session data is cached to disk for reuse across process restarts.
 *
 * @see {@link AuthClient} for full documentation.
 * @see {@link LoginOptions} for configuration options.
 * @public
 * @since 0.1.1
 */
export { AuthClient, type LoginOptions } from './auth/login.js'

/**
 * Client for terminating an authenticated session.
 *
 * @remarks
 * Loads the cached session from disk, sends a POST request to the logout endpoint,
 * and clears the local cache on success.
 *
 * @see {@link LogoutClient} for full documentation.
 * @see {@link LogoutOptions} for configuration options.
 * @public
 * @since 0.1.1
 */
export { LogoutClient, type LogoutOptions } from './auth/logout.js'

// Re-export all internal modules via preloader (includes config, env, error, utils)
/**
 * All internal modules (configuration, error handling, utilities).
 *
 * @remarks
 * This re‑export includes:
 * - Configuration: `EnvConfig`, `loadEnv`, `EnvConfigOptions`, `EnvVars`
 * - Error handling: `AuthError`, `AuthErrorCode`, `AuthErrorCodeType`
 * - Utilities: `parseCookies`, `buildCookieHeader`, `parseSetCookie`,
 *   `extractCsrfToken`, `fetchWithRetry`, `CacheManager`, `Cookie`,
 *   `SessionData`, `isSessionFresh`, `sessionWithCsrfToken`
 *
 * @public
 * @since 0.1.1
 */
export * from './preloader.js'

// Re-export session management
export {
	/**
	 * Manages persistent session storage on disk.
	 *
	 * @remarks
	 * Provides methods to save, load, update, and delete session data
	 * from the file system. The default cache location is
	 * `~/.cache/libts-csrfx-auth/session.json`.
	 *
	 * @see {@link CacheManager}
	 * @since 0.1.1
	 */
	CacheManager,

	/**
	 * Represents an HTTP cookie with domain, path, and security flags.
	 *
	 * @remarks
	 * Used to store cookies persistently in the session cache.
	 *
	 * @see {@link Cookie}
	 * @since 0.1.1
	 */
	type Cookie,

	/**
	 * Complete session data structure containing cookies, CSRF token, and timestamp.
	 *
	 * @remarks
	 * This object is serialized to JSON and saved to disk.
	 *
	 * @see {@link SessionData}
	 * @since 0.1.1
	 */
	type SessionData,

	/**
	 * Checks if a cached session is still within its freshness window.
	 *
	 * @param session - The session to check.
	 * @param maxAgeMs - Maximum allowed age in milliseconds.
	 * @returns `true` if the session's timestamp is within the last `maxAgeMs` milliseconds.
	 *
	 * @see {@link isSessionFresh}
	 * @since 0.1.1
	 */
	isSessionFresh,

	/**
	 * Creates a new session object with an updated CSRF token and current timestamp.
	 *
	 * @param session - The original session data.
	 * @param newToken - The new CSRF token to set.
	 * @returns A new `SessionData` object with the updated token and current timestamp.
	 *
	 * @see {@link sessionWithCsrfToken}
	 * @since 0.1.1
	 */
	sessionWithCsrfToken,
} from './utils/session.js'

// Re-export CSRF extraction
/**
 * Extracts a CSRF token from an HTML string.
 *
 * @remarks
 * Searches for `<input name="_token" value="...">` or
 * `<meta name="csrf-token" content="...">` patterns.
 *
 * @param html - The full HTML document as a string.
 * @returns The extracted token, or `null` if not found.
 *
 * @see {@link extractCsrfToken}
 * @since 0.1.1
 * @public
 */
export { extractCsrfToken } from './utils/csrf.js'

// Re-export cookie utilities
export {
	/**
	 * Parses `Set-Cookie` headers from a Response object into a Map.
	 *
	 * @param headers - The `Headers` object from a `fetch` Response.
	 * @returns A `Map` of cookie names to values.
	 *
	 * @see {@link parseCookies}
	 * @since 0.1.1
	 */
	parseCookies,

	/**
	 * Serializes a Map of cookies into a `Cookie` header string.
	 *
	 * @param cookies - A `Map` where keys are cookie names and values are cookie values.
	 * @returns A semicolon‑separated string suitable for the `Cookie` header.
	 *
	 * @see {@link buildCookieHeader}
	 * @since 0.1.1
	 */
	buildCookieHeader,

	/**
	 * Extracts name and value from a raw `Set-Cookie` header string.
	 *
	 * @param cookieStr - The raw `Set-Cookie` header string.
	 * @returns An object with `name` and `value`, or `null` if invalid.
	 *
	 * @see {@link parseSetCookie}
	 * @since 0.1.1
	 */
	parseSetCookie,
} from './utils/cookies.js'

// Re-export HTTP utilities
/**
 * HTTP client with automatic retries and timeout support.
 *
 * @remarks
 * Wraps `fetch` with exponential backoff retries and per‑request timeout.
 *
 * @param url - The request URL.
 * @param options - Configuration options (timeout, retries, headers, etc.).
 * @param shouldRetry - Optional predicate to override `retryOn`.
 * @returns A `Response` object from the first successful request.
 * @throws {AuthError} With code `NETWORK_ERROR` when all attempts fail.
 *
 * @see {@link fetchWithRetry}
 * @see {@link FetchOptions}
 * @since 0.1.1
 * @public
 */
export { fetchWithRetry, type FetchOptions } from './utils/http.js'

// Re-export configuration
export {
	/**
	 * Validated configuration class for endpoints and credentials.
	 *
	 * @remarks
	 * Normalizes and validates base URL, login/logout paths, email, and password.
	 *
	 * @see {@link EnvConfig}
	 * @since 0.1.1
	 */
	EnvConfig,

	/**
	 * Loads environment variables from `.env` file and `Bun.env`.
	 *
	 * @returns A validated `EnvVars` object.
	 * @throws {Error} If `BASE_URL` is missing or invalid.
	 *
	 * @see {@link loadEnv}
	 * @since 0.1.1
	 */
	loadEnv,

	/**
	 * Options for constructing an `EnvConfig` instance.
	 *
	 * @see {@link EnvConfigOptions}
	 * @since 0.1.1
	 */
	type EnvConfigOptions,

	/**
	 * Raw environment variable interface.
	 *
	 * @see {@link EnvVars}
	 * @since 0.1.1
	 */
	type EnvVars,
} from './handler/config.js'

// Re-export error handling
export {
	/**
	 * Standard error class for all authentication failures.
	 *
	 * @remarks
	 * Extends `Error` with a typed error code, optional context, and timestamp.
	 * Provides static factories for creating instances from HTTP responses,
	 * unknown errors, or raw status codes.
	 *
	 * @see {@link AuthError}
	 * @since 0.1.1
	 */
	AuthError,

	/**
	 * Object containing all possible error code strings.
	 *
	 * @remarks
	 * Use these constants to compare against the `code` property of an `AuthError`.
	 *
	 * @see {@link AuthErrorCode}
	 * @since 0.1.1
	 */
	AuthErrorCode,

	/**
	 * Union type of valid error codes (alias for `AuthErrorCode`).
	 *
	 * @see {@link AuthErrorCodeType}
	 * @since 0.1.1
	 */
	type AuthErrorCode as AuthErrorCodeType,
} from './handler/error.js'

/**
 * Returns an object containing the library name and version.
 *
 * @returns An object with `version` and `name` properties.
 *
 * @remarks
 * Useful for logging, debugging, or constructing custom `User-Agent` headers.
 *
 * @example
 * const info = buildInfo();
 * console.log(`${info.name} v${info.version}`); // "libts-csrfx-auth v0.1.1"
 *
 * @public
 * @since 0.1.1
 * @see {@link VERSION}
 * @see {@link NAME}
 */
export function buildInfo(): {
	readonly version: typeof VERSION
	readonly name: typeof NAME
} {
	return { version: VERSION, name: NAME }
}
