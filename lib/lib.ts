export { AuthClient, type LoginOptions } from './auth/login.js'
export { LogoutClient, type LogoutOptions } from './auth/logout.js'
export * from './preloader.js'
export {
	CacheManager,
	type SessionData,
	type Cookie,
	isSessionFresh,
	sessionWithCsrfToken,
} from './utils/session.js'
export { extractCsrfToken } from './utils/csrf.js'
export { parseCookies, buildCookieHeader, parseSetCookie } from './utils/cookies.js'
export { fetchWithRetry, type FetchOptions } from './utils/http.js'
export { EnvConfig, loadEnv, type EnvConfigOptions, type EnvVars } from './handler/config.js'
export {
	AuthError,
	AuthErrorCode,
	type AuthErrorCode as AuthErrorCodeType,
} from './handler/error.js'
export const VERSION = '0.1.0' as const
export const NAME = 'libts-csrfx-auth' as const
export function buildInfo(): {
	readonly version: typeof VERSION
	readonly name: typeof NAME
} {
	return { version: VERSION, name: NAME }
}
