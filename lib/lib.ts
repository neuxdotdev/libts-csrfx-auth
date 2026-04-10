import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkgPath = join(__dirname, '..', 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as {
  name: string;
  version: string;
};

export const VERSION = pkg.version;
export const NAME = pkg.name;

export { AuthClient, type LoginOptions } from './auth/login.js';
export { LogoutClient, type LogoutOptions } from './auth/logout.js';
export * from './preloader.js';
export {
  CacheManager,
  type SessionData,
  type Cookie,
  isSessionFresh,
  sessionWithCsrfToken,
} from './utils/session.js';
export { extractCsrfToken } from './utils/csrf.js';
export {
  parseCookies,
  buildCookieHeader,
  parseSetCookie,
} from './utils/cookies.js';
export { fetchWithRetry, type FetchOptions } from './utils/http.js';
export {
  EnvConfig,
  loadEnv,
  type EnvConfigOptions,
  type EnvVars,
} from './handler/config.js';
export {
  AuthError,
  AuthErrorCode,
  type AuthErrorCode as AuthErrorCodeType,
} from './handler/error.js';

export function buildInfo(): {
  readonly version: typeof VERSION;
  readonly name: typeof NAME;
} {
  return { version: VERSION, name: NAME };
}