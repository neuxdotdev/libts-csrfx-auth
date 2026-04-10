/**
 * @fileoverview Central export point for authentication clients.
 *
 * This module re‑exports the `AuthClient` (login) and `LogoutClient` (logout)
 * along with their respective options types. Consumers should import directly
 * from this index for a clean API surface.
 *
 * @module auth/index
 * @public
 */

/**
 * The main authentication client for CSRF‑protected login flows.
 *
 * @remarks
 * The `AuthClient` handles the complete two‑step login process:
 * - Fetches a CSRF token from the login page.
 * - Submits credentials with the token.
 * - Persists session data (cookies, token) to disk cache.
 *
 * Configuration can be provided via environment variables (`.env` file)
 * or constructor options. The client supports retries, timeouts, and
 * custom HTTP headers.
 *
 * @example
 * // Basic usage with environment variables
 * import { AuthClient } from 'libts-csrfx-auth';
 *
 * const auth = new AuthClient();
 * const session = await auth.login();
 * console.log('Logged in, CSRF token:', session.csrfToken);
 *
 * @example
 * // Override credentials
 * const auth = new AuthClient({
 *   email: 'user@example.com',
 *   password: 'secret'
 * });
 *
 * @see {@link AuthClient} for full documentation.
 * @see {@link LoginOptions} for configuration options.
 * @since 0.1.1
 * @public
 */
export { AuthClient, type LoginOptions } from './login.js'

/**
 * The client for terminating an authenticated session.
 *
 * @remarks
 * The `LogoutClient` loads a previously cached session (created by `AuthClient`),
 * extracts the cookies and CSRF token, and sends a POST request to the logout endpoint.
 * On success, the local session cache is deleted. Supports custom timeouts,
 * retries, and optional `Referer`/`Origin` headers.
 *
 * @example
 * // Basic logout
 * import { LogoutClient } from 'libts-csrfx-auth';
 *
 * const logout = new LogoutClient();
 * await logout.logout(); // uses cached session
 *
 * @example
 * // Custom configuration
 * const logout = new LogoutClient({
 *   baseUrl: 'https://example.com',
 *   timeoutMs: 30000
 * });
 *
 * @see {@link LogoutClient} for full documentation.
 * @see {@link LogoutOptions} for configuration options.
 * @since 0.1.1
 * @public
 */
export { LogoutClient, type LogoutOptions } from './logout.js'
