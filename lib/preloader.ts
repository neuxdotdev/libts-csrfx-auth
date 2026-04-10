/**
 * @fileoverview Internal preloader that aggregates all public exports from the library.
 *
 * This module is primarily used for internal bundling and to simplify the main
 * `lib.ts` entry point. It re‑exports everything from the authentication clients,
 * configuration handlers, error utilities, and all helper modules (cookies, CSRF,
 * HTTP, session). End users should typically import directly from the main entry
 * point (`lib.js` / `lib.ts`) rather than this preloader.
 *
 * @module preloader
 * @internal
 * @remarks
 * This file is not intended for direct consumption by end users. It serves as an
 * internal aggregation layer for the main entry point. All public APIs are
 * re‑exported from `lib.ts`. Importing from this module directly may lead to
 * breaking changes in future versions.
 *
 * @see {@link lib.ts} - The main entry point for the library.
 * @since 0.1.1
 */

// Authentication clients
/**
 * Authentication client for CSRF‑protected login flows.
 *
 * @see {@link AuthClient}
 * @see {@link LoginOptions}
 * @internal
 */
export * from './auth/login.js'

/**
 * Client for terminating an authenticated session.
 *
 * @see {@link LogoutClient}
 * @see {@link LogoutOptions}
 * @internal
 */
export * from './auth/logout.js'

// Configuration and environment handling
/**
 * Configuration validation and normalization utilities.
 *
 * @see {@link EnvConfig}
 * @see {@link EnvConfigOptions}
 * @see {@link EnvVars}
 * @see {@link loadEnv}
 * @internal
 */
export * from './handler/config.js'

/**
 * Environment variable loader with `.env` file support.
 *
 * @see {@link loadEnv}
 * @see {@link EnvVars}
 * @internal
 */
export * from './handler/env.js'

// Error classes and utilities
/**
 * Centralized error handling for authentication flows.
 *
 * @see {@link AuthError}
 * @see {@link AuthErrorCode}
 * @see {@link isRetryableError}
 * @see {@link isAuthenticationError}
 * @internal
 */
export * from './handler/error.js'

// Utility modules
/**
 * Cookie parsing and serialization utilities.
 *
 * @see {@link parseCookies}
 * @see {@link buildCookieHeader}
 * @see {@link parseSetCookie}
 * @internal
 */
export * from './utils/cookies.js'

/**
 * CSRF token extraction from HTML.
 *
 * @see {@link extractCsrfToken}
 * @internal
 */
export * from './utils/csrf.js'

/**
 * HTTP client with retry and timeout support.
 *
 * @see {@link fetchWithRetry}
 * @see {@link FetchOptions}
 * @internal
 */
export * from './utils/http.js'

/**
 * Persistent session storage on the file system.
 *
 * @see {@link CacheManager}
 * @see {@link Cookie}
 * @see {@link SessionData}
 * @see {@link isSessionFresh}
 * @see {@link sessionWithCsrfToken}
 * @internal
 */
export * from './utils/session.js'
