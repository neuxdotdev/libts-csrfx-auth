# libts-csrfx-auth

> **Minimal TypeScript auth handler for web sessions, CSRF tokens, and cookie persistence — inspired by Rust's cekunit-client.**

<p align="center">
  <a href="https://www.npmjs.com/package/libts-csrfx-auth" target="_blank" rel="noopener">
    <img src="https://img.shields.io/npm/v/libts-csrfx-auth.svg?style=flat-square&logo=npm&logoColor=white&color=cb3837" alt="npm version" height="20">
  </a>
  <a href="https://github.com/neuxdotdev/libts-csrfx-auth/blob/main/license" target="_blank" rel="noopener">
    <img src="https://img.shields.io/github/license/neuxdotdev/libts-csrfx-auth?style=flat-square&color=blue" alt="license" height="20">
  </a>
  <a href="https://github.com/neuxdotdev/libts-csrfx-auth/actions/workflows/build.yml" target="_blank" rel="noopener">
    <img src="https://github.com/neuxdotdev/libts-csrfx-auth/actions/workflows/build.yml/badge.svg?branch=main&style=flat-square" alt="build status" height="20">
  </a>
  <a href="https://github.com/neuxdotdev/libts-csrfx-auth/actions" target="_blank" rel="noopener">
    <img src="https://img.shields.io/github/actions/workflow/status/neuxdotdev/libts-csrfx-auth/build.yml?branch=main&style=flat-square&logo=github&logoColor=white" alt="CI" height="20">
  </a>
  <a href="https://www.typescriptlang.org" target="_blank" rel="noopener">
    <img src="https://img.shields.io/badge/TypeScript-5.8+-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" height="20">
  </a>
  <a href="https://bun.sh" target="_blank" rel="noopener">
    <img src="https://img.shields.io/badge/Bun-1.3+-fbf0df?style=flat-square&logo=bun&logoColor=000" alt="Bun" height="20">
  </a>
  <a href="https://nodejs.org" target="_blank" rel="noopener">
    <img src="https://img.shields.io/badge/Node.js-≥18-339933?style=flat-square&logo=nodedotjs&logoColor=white" alt="Node.js" height="20">
  </a>
  <a href="https://prettier.io" target="_blank" rel="noopener">
    <img src="https://img.shields.io/badge/code_style-prettier-ff69b4?style=flat-square&logo=prettier&logoColor=white" alt="code style" height="20">
  </a>
  <a href="http://makeapullrequest.com" target="_blank" rel="noopener">
    <img src="https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square" alt="PRs welcome" height="20">
  </a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/libts-csrfx-auth" target="_blank" rel="noopener">
    <img src="https://img.shields.io/npm/dm/libts-csrfx-auth?style=flat-square&logo=npm&color=cb3837" alt="npm downloads" height="18">
  </a>
  <a href="https://bundlephobia.com/package/libts-csrfx-auth" target="_blank" rel="noopener">
    <img src="https://img.shields.io/bundlephobia/minzip/libts-csrfx-auth?style=flat-square&label=minzipped&color=orange" alt="bundle size" height="18">
  </a>
</p>

---

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Core Concepts](#core-concepts)
    - [CSRF‑Protected Login Flow](#csrf‑protected-login-flow)
    - [Session Caching](#session-caching)
    - [Retry & Timeout Mechanism](#retry--timeout-mechanism)
- [Library API](#library-api)
    - [`AuthClient`](#authclient)
        - [Constructor Options (`LoginOptions`)](#constructor-options-loginoptions)
        - [Methods](#authclient-methods)
        - [Properties](#authclient-properties)
    - [`LogoutClient`](#logoutclient)
        - [Constructor Options (`LogoutOptions`)](#constructor-options-logoutoptions)
        - [Methods](#logoutclient-methods)
        - [Properties](#logoutclient-properties)
    - [`EnvConfig` (Configuration)](#envconfig-configuration)
        - [Static Factory](#static-factory)
        - [Instance Properties & Methods](#instance-properties--methods)
    - [`CacheManager` (Session Persistence)](#cachemanager-session-persistence)
        - [Constructor](#constructor)
        - [Methods](#cachemanager-methods)
        - [Properties](#cachemanager-properties)
    - [Utility Functions](#utility-functions)
        - [Cookie Utilities](#cookie-utilities)
        - [CSRF Extraction](#csrf-extraction)
        - [HTTP Client with Retry](#http-client-with-retry)
        - [Session Helpers](#session-helpers)
- [Error Handling](#error-handling)
    - [`AuthError` Class](#autherror-class)
    - [Error Codes (`AuthErrorCode`)](#error-codes-autherrorcode)
    - [Retryable vs Authentication Errors](#retryable-vs-authentication-errors)
    - [Built‑in Guards](#builtin-guards)
- [Advanced Usage](#advanced-usage)
    - [Custom Cache Directory](#custom-cache-directory)
    - [Overriding Headers (Referer/Origin)](#overriding-headers-refererorigin)
    - [Manual CSRF Token Management](#manual-csrf-token-management)
    - [Using with Node.js (without Bun)](#using-with-nodejs-without-bun)
- [Development](#development)
    - [Project Structure](#project-structure)
    - [Scripts](#scripts)
    - [Testing](#testing)
    - [Documentation Generation](#documentation-generation)
    - [Release Process](#release-process)
- [Troubleshooting](#troubleshooting)
    - [Common Errors](#common-errors)
    - [Debugging Tips](#debugging-tips)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

`libts-csrfx-auth` is a **TypeScript‑first** library that automates authentication against web applications protected by **CSRF tokens**. It handles the complete two‑step login flow (GET login page → extract token → POST credentials), persists session data (cookies + token) to disk, and supports logout with automatic cache cleanup.

---

## Installation

```bash
# Bun (recommended – fastest)
bun add libts-csrfx-auth

# npm
npm install libts-csrfx-auth

# pnpm
pnpm add libts-csrfx-auth

# yarn
yarn add libts-csrfx-auth
```

**Requirements:**

- Node.js **>=18** (for native `fetch` and `AbortController`)
- or Bun **>=1.3++**

---

## Quick Start

Create a `.env` file in your project root:

```env
BASE_URL=https://example.com
LOGIN_PATH=login
LOGOUT_PATH=logout
USER_EMAIL=admin@example.com
USER_PASSWORD=secret
```

Then:

```typescript
import { AuthClient, LogoutClient } from 'libts-csrfx-auth'

const auth = new AuthClient()
const session = await auth.login()
console.log(`Logged in! CSRF token: ${session.csrfToken}`)

// Reuse cached session on next run
if (await auth.hasValidSession()) {
	const cached = await auth.getCachedSession()
	console.log(`Session from ${new Date(cached.timestamp)}`)
}

// Logout
const logout = new LogoutClient()
await logout.logout()
```

---

## Environment Variables

The library uses `loadEnv()` to read variables from `.env` (project root) and then falls back to `Bun.env` / `process.env`. All variables are validated.

| Variable        | Required | Default  | Validation                                                       |
| --------------- | -------- | -------- | ---------------------------------------------------------------- |
| `BASE_URL`      | [x]      | –        | Must be `http://` or `https://`, no trailing slash required.     |
| `LOGIN_PATH`    | [ ]      | `login`  | No `?` or `#`, cannot be empty string.                           |
| `LOGOUT_PATH`   | [ ]      | `logout` | No `?` or `#`, cannot be empty string.                           |
| `USER_EMAIL`    | [ ]      | –        | Basic email regex (`local@domain.tld`). Empty string is ignored. |
| `USER_PASSWORD` | [ ]      | –        | Cannot be empty string if provided.                              |

> _`AuthClient` requires both email and password to be non‑empty (throws `INVALID_CREDENTIALS` otherwise)._

Example `.env`:

```env
BASE_URL=https://staging.example.com
LOGIN_PATH=api/login
USER_EMAIL=ci@example.com
USER_PASSWORD=ci123
```

---

## Core Concepts

### CSRF‑Protected Login Flow

Most modern web frameworks (Laravel, Rails, Django, Symfony) protect login endpoints with a CSRF token that must be submitted along with credentials. The token is usually embedded in the login HTML page.

`AuthClient` automates this:

1. **GET** `BASE_URL/LOGIN_PATH` – extracts the CSRF token from the HTML (supports `<input name="_token" value="...">` and `<meta name="csrf-token" content="...">`).
2. Captures any `Set-Cookie` headers from the GET response (session cookie, etc.).
3. **POST** to the same URL with `_token`, `email`, `password`, and the captured cookies.
4. On success (HTTP 2xx), extracts new cookies from the response and saves the session to disk.

### Session Caching

After a successful login, the session is saved as JSON to:

```
~/.cache/libts-csrfx-auth/session.json
```

The structure (`SessionData`):

```typescript
interface SessionData {
	cookies: Cookie[] // { name, value, domain, path, httpOnly, secure }
	csrfToken: string // current CSRF token
	loggedIn: boolean // always true after login
	timestamp: number // Unix ms (Date.now())
}
```

On subsequent runs, `hasValidSession(maxAgeMs)` checks if the cached session is fresh (default 1 hour) and `loggedIn === true`. If valid, you can reuse it without re‑authenticating.

### Retry & Timeout Mechanism

`fetchWithRetry()` wraps `globalThis.fetch` with:

- **Timeout** – uses `AbortController`; if exceeded, the attempt is aborted and counted as a failure.
- **Retries** – up to `maxRetries` attempts (default 3). Retryable conditions:
    - Network errors (DNS, TLS, socket)
    - Timeouts
    - HTTP 5xx (server errors) and 429 (rate limit) – configurable via `retryOn` predicate.
- **Exponential backoff** – delay = `retryDelayMs * 2^attempt` (e.g., 100ms, 200ms, 400ms).

Both `AuthClient` and `LogoutClient` use this internally with sensible defaults.

---

## Library API

### `AuthClient`

The main client for logging in.

```typescript
class AuthClient {
	constructor(options?: LoginOptions)
	login(): Promise<SessionData>
	getCachedSession(): Promise<SessionData | null>
	hasValidSession(maxAgeMs?: number): Promise<boolean>
	clearSession(): Promise<void>
	readonly cacheFilePath: string
	readonly configRef: EnvConfig
}
```

#### Constructor Options (`LoginOptions`)

| Option         | Type      | Default                     | Description                                          |
| -------------- | --------- | --------------------------- | ---------------------------------------------------- |
| `baseUrl`      | `string`  | `BASE_URL` env              | Override base URL.                                   |
| `email`        | `string`  | `USER_EMAIL` env            | Override email.                                      |
| `password`     | `string`  | `USER_PASSWORD` env         | Override password.                                   |
| `cacheDir`     | `string`  | `~/.cache/libts-csrfx-auth` | Custom directory for session cache.                  |
| `maxRetries`   | `number`  | `3`                         | Max retry attempts (excluding initial try).          |
| `retryDelayMs` | `number`  | `100`                       | Initial delay before first retry (exponential).      |
| `timeoutMs`    | `number`  | `15000`                     | Request timeout in ms.                               |
| `sendReferer`  | `boolean` | `true`                      | Send `Referer` header in both GET and POST requests. |
| `sendOrigin`   | `boolean` | `true`                      | Send `Origin` header in both requests.               |

#### `AuthClient` Methods

##### `login(): Promise<SessionData>`

Performs the full two‑step login. Throws `AuthError` on failure. Saves session to disk.

##### `getCachedSession(): Promise<SessionData | null>`

Returns the raw cached session (no freshness check). `null` if none exists or file corrupted.

##### `hasValidSession(maxAgeMs = 3_600_000): Promise<boolean>`

Returns `true` if a cached session exists, is fresh (age < `maxAgeMs`), and `loggedIn === true`. Does **not** contact the server.

##### `clearSession(): Promise<void>`

Deletes both the in‑memory cookie jar and the persistent cache file.

##### `cacheFilePath: string`

Full path to the session JSON file (e.g., `/home/user/.cache/libts-csrfx-auth/session.json`).

##### `configRef: EnvConfig`

The internal `EnvConfig` instance (read‑only) for advanced inspection.

---

### `LogoutClient`

Terminates an authenticated session.

```typescript
class LogoutClient {
	constructor(options?: LogoutOptions)
	logout(): Promise<void>
	logoutWithToken(csrfToken: string): Promise<void>
	clearCache(): Promise<void>
	loadCache(): Promise<SessionData | null>
	readonly configRef: EnvConfig
}
```

#### Constructor Options (`LogoutOptions`)

| Option        | Type      | Default                     | Description                    |
| ------------- | --------- | --------------------------- | ------------------------------ |
| `baseUrl`     | `string`  | `BASE_URL` env              | Override base URL.             |
| `cacheDir`    | `string`  | `~/.cache/libts-csrfx-auth` | Custom cache directory.        |
| `timeoutMs`   | `number`  | `15000`                     | Request timeout in ms.         |
| `sendReferer` | `boolean` | `true`                      | Send `Referer` header in POST. |
| `sendOrigin`  | `boolean` | `true`                      | Send `Origin` header in POST.  |

#### `LogoutClient` Methods

##### `logout(): Promise<void>`

Loads the cached session, extracts cookies and CSRF token, sends a POST request to `LOGOUT_PATH` with `_token`. On HTTP 2xx/3xx, clears the local cache.

##### `logoutWithToken(csrfToken: string): Promise<void>`

Same as `logout()`, but uses the explicitly provided token instead of the cached one. Useful if you have a refreshed token.

##### `clearCache(): Promise<void>`

Deletes the cache file without contacting the server.

##### `loadCache(): Promise<SessionData | null>`

Loads the cached session (no validation).

##### `configRef: EnvConfig`

Internal configuration (read‑only).

---

### `EnvConfig` (Configuration)

Validates and normalizes configuration.

```typescript
class EnvConfig {
	constructor(options: EnvConfigOptions)
	static fromEnv(overrides?: Partial<EnvConfigOptions>): EnvConfig
	get fullLoginUrl(): string
	get fullLogoutUrl(): string
	hasValidCredentials(): boolean
	readonly baseUrl: string
	readonly loginPath: string
	readonly logoutPath: string
	readonly email: string
	readonly password: string
}
```

#### Static Factory

```typescript
const config = EnvConfig.fromEnv({ email: 'override@example.com' })
```

Reads `loadEnv()` and applies overrides. Throws if `BASE_URL` missing.

#### Instance Properties & Methods

- `fullLoginUrl` / `fullLogoutUrl` – fully constructed URLs (base + path, no double slashes).
- `hasValidCredentials()` – basic check: `email` and `password` non‑empty and email contains `@`.

---

### `CacheManager` (Session Persistence)

Low‑level disk cache manager.

```typescript
class CacheManager {
	constructor(customDir?: string)
	save(session: SessionData): Promise<void>
	load(): Promise<SessionData | null>
	clear(): Promise<void>
	updateCsrfToken(newToken: string): Promise<void>
	loadFresh(maxAgeMs: number): Promise<SessionData | null>
	readonly cacheFilePath: string
	readonly cacheDirPath: string
}
```

**Default location:** `~/.cache/libts-csrfx-auth/session.json`

#### Methods

- `save(session)` – writes JSON (pretty‑printed) to disk, creates directory if missing.
- `load()` – reads and parses JSON; returns `null` on any error (ENOENT, invalid JSON).
- `clear()` – deletes the file if it exists.
- `updateCsrfToken(newToken)` – loads existing session, updates token and timestamp, saves back (no‑op if no session).
- `loadFresh(maxAgeMs)` – loads and checks age; returns session only if `Date.now() - session.timestamp < maxAgeMs`.

---

### Utility Functions

All utilities are exported from the main entry point.

#### Cookie Utilities

```typescript
parseCookies(headers: Headers): Map<string, string>
```

Extracts all `Set-Cookie` headers from a `fetch` response and returns a `Map` of name → value. Uses `headers.getSetCookie()` (modern API) – falls back to empty array.

```typescript
buildCookieHeader(cookies: Map<string, string>): string
```

Serialises a cookie map into a `Cookie` header string: `"name1=value1; name2=value2"`.

```typescript
parseSetCookie(cookieStr: string): { name: string; value: string } | null
```

Parses a raw `Set-Cookie` header (e.g., `"sessionId=abc123; HttpOnly"`) and returns the first `name=value` pair before the first semicolon. Returns `null` if invalid.

#### CSRF Extraction

```typescript
extractCsrfToken(html: string): string | null
```

Scans HTML for `<input name="_token" value="...">` or `<meta name="csrf-token" content="...">`. Regular expressions are case‑insensitive and handle attribute order variations.

#### HTTP Client with Retry

```typescript
fetchWithRetry(
  url: string | URL,
  options?: FetchOptions,
  shouldRetry?: (res: Response) => boolean
): Promise<Response>
```

`FetchOptions` extends `RequestInit` (except `signal`) and adds:

- `timeoutMs?: number` (default 15000)
- `maxRetries?: number` (default 3)
- `retryDelayMs?: number` (default 100)
- `retryOn?: (res: Response) => boolean` (default retries only on HTTP 5xx)

Throws `AuthError` with code `NETWORK_ERROR` when all attempts fail.

#### Session Helpers

```typescript
isSessionFresh(session: SessionData, maxAgeMs: number): boolean
```

Returns `true` if `Date.now() - session.timestamp < maxAgeMs`.

```typescript
sessionWithCsrfToken(session: SessionData, newToken: string): SessionData
```

Creates a new session object with updated token and current timestamp (immutable).

---

## Error Handling

All errors thrown by the library are instances of `AuthError`.

### `AuthError` Class

```typescript
class AuthError extends Error {
	readonly code: AuthErrorCode
	readonly context?: string
	readonly timestamp: number
	constructor(
		message: string,
		code: AuthErrorCode,
		options?: { cause?: unknown; context?: string },
	)
	static fromResponse(
		response: Response,
		defaultCode: AuthErrorCode,
		options?: { context?: string },
	): AuthError
	static fromUnknown(err: unknown, fallbackCode?: AuthErrorCode): AuthError
	static fromStatus(status: number, body?: string): AuthError
	toJSON(): Record<string, unknown>
	getFormattedMessage(): string
}
```

- `fromResponse` – maps HTTP status codes (see table below) to error codes.
- `fromUnknown` – intelligently extracts message/code from `DOMException` (AbortError), `TypeError` (fetch), or generic `Error`.
- `toJSON()` – safe for logging (includes trimmed stack).
- `getFormattedMessage()` – returns `[CODE] message | Context: ... | Cause: ...`.

### Error Codes (`AuthErrorCode`)

| Code                  | Retryable | Typical HTTP status  | Description                                         |
| --------------------- | --------- | -------------------- | --------------------------------------------------- |
| `INVALID_CREDENTIALS` |           | –                    | Email or password empty / malformed.                |
| `CSRF_NOT_FOUND`      |           | –                    | Token missing in HTML.                              |
| `CSRF_FETCH_FAILED`   |           | –                    | GET login page failed (network/4xx/5xx).            |
| `CSRF_EXPIRED`        |           | 419                  | Token expired (server response).                    |
| `LOGIN_FAILED`        |           | 4xx (except 419/422) | Login POST returned non‑2xx, non‑retryable.         |
| `LOGOUT_FAILED`       |           | 4xx (except 419/422) | Logout POST failed.                                 |
| `NOT_AUTHENTICATED`   |           | –                    | No valid session in cache.                          |
| `NETWORK_ERROR`       |           | –                    | DNS, TLS, socket, or `fetch` throw.                 |
| `TIMEOUT`             |           | –                    | Request aborted due to timeout.                     |
| `CACHE_ERROR`         |           | –                    | File system read/write error.                       |
| `VALIDATION_ERROR`    |           | 400, 422             | Form validation error (e.g., wrong email/password). |
| `TOO_MANY_REQUESTS`   |           | 429                  | Rate limited.                                       |
| `SERVER_ERROR`        |           | 5xx                  | Server internal error.                              |
| `UNAUTHORIZED`        |           | 401                  | Not authenticated (missing/invalid session).        |
| `FORBIDDEN`           |           | 403                  | Authenticated but not allowed.                      |
| `NOT_FOUND`           |           | 404                  | Endpoint does not exist.                            |
| `UNKNOWN`             |           | –                    | Catch‑all.                                          |

### Retryable vs Authentication Errors

Use the built‑in guards:

```typescript
import { isRetryableError, isAuthenticationError } from 'libts-csrfx-auth'

try {
	await auth.login()
} catch (err) {
	if (isRetryableError(err)) {
		// The error may resolve on a subsequent attempt (network hiccup, server overload).
		// The library already retries automatically, but you can add custom logic.
	}
	if (isAuthenticationError(err)) {
		// Credentials are wrong, CSRF expired, or user not logged in.
		// Redirect to login UI, prompt for new credentials.
	}
}
```

---

## Advanced Usage

### Custom Cache Directory

```typescript
const auth = new AuthClient({ cacheDir: './my-session-cache' })
// Session stored in ./my-session-cache/session.json
```

### Overriding Headers (Referer/Origin)

Some servers require these headers for CSRF validation. You can disable them if not needed:

```typescript
const auth = new AuthClient({ sendReferer: false, sendOrigin: false })
```

### Manual CSRF Token Management

If you have a token from another source (e.g., API response), you can update the cache:

```typescript
await auth.cacheManager.updateCsrfToken('new_token_from_api')
```

Or create a new session object:

```typescript
const updated = sessionWithCsrfToken(oldSession, 'fresh_token')
await auth.cacheManager.save(updated)
```

### Using with Node.js (without Bun)

The library uses `Bun.env` for environment access; in Node.js it falls back to `process.env`. No additional polyfills are required for `fetch` (Node 18+).

---

## Development

### Project Structure

```
.
├── lib/                      # Source code
│   ├── auth/                 # AuthClient, LogoutClient
│   ├── handler/              # EnvConfig, loadEnv, AuthError
│   ├── utils/                # cookies, csrf, http, session
│   ├── lib.ts                # Public API barrel
│   └── preloader.ts          # Internal re‑exports
├── build/                    # Compiled output (CJS, ESM, types)
├── docs/                     # Generated HTML documentation
├── docs-md/                  # Optional Markdown output
├── scripts/                  # Build helpers
├── test/                     # Unit tests (Bun test)
├── package.json
├── tsconfig.json
├── typedoc.json
└── rollup.config.mjs
```

### Scripts

| Command                  | Description                                           |
| ------------------------ | ----------------------------------------------------- |
| `bun run clean`          | Delete `build/` and cache.                            |
| `bun run typecheck`      | Run `tsc --noEmit`.                                   |
| `bun run format`         | Format all source files with Prettier.                |
| `bun run clean-code`     | Run `rmcm` (remove comments) – used for distribution. |
| `bun run build:lib:prod` | Bundle library (minified) with Rollup.                |
| `bun run rebuild`        | Clean → typecheck → build → format → docs.            |
| `bun run test`           | Run tests with Bun.                                   |
| `bun run test:coverage`  | Run tests with coverage report (requires `bun:test`). |
| `bun run docs:generate`  | Generate HTML docs with TypeDoc.                      |
| `bun run docs:serve`     | Serve docs locally (port 8080).                       |
| `bun run version:patch`  | Bump patch version in `package.json`.                 |
| `bun run release`        | Publish to npm (runs `prepublishOnly`).               |

### Testing

Tests are written with Bun's built‑in test runner:

```bash
bun run test
bun run test:coverage
```

Mock HTTP responses are recommended – the library does not make real network calls during unit tests.

### Documentation Generation

TypeDoc generates API documentation from the TSDoc comments.

```bash
bun run docs:generate   # outputs to docs/
bun run docs:serve      # serves on http://localhost:8080
```

### Release Process

1. Update version in `package.json` (or run `bun run version:patch`).
2. Run `bun run rebuild` to ensure everything builds.
3. Run `bun run test` to verify.
4. Publish: `bun run release` (which runs `npm publish`).

---

## Troubleshooting

### Common Errors

| Error                                               | Likely cause                                | Solution                                                                                            |
| --------------------------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `EnvConfig: baseUrl must be a valid HTTP/HTTPS URL` | `BASE_URL` missing or malformed.            | Check `.env` or environment; ensure `http://` or `https://`.                                        |
| `CSRF token not found in HTML`                      | Login page HTML doesn’t contain token.      | Verify `LOGIN_PATH` is correct; inspect the page manually.                                          |
| `HTTP 419: CSRF token expired or invalid`           | Token from GET page is stale.               | The library retries automatically; if persistent, the server may require a fresh token per attempt. |
| `Validation error: email/password incorrect`        | Wrong credentials (HTTP 422).               | Check `USER_EMAIL` / `USER_PASSWORD`.                                                               |
| `No valid session found` (logout)                   | No cached session or `loggedIn: false`.     | Run `auth.login()` first.                                                                           |
| `NETWORK_ERROR` after retries                       | Server unreachable, DNS failure, TLS error. | Check network connectivity; increase `maxRetries` or `timeoutMs`.                                   |

### Debugging Tips

- Enable `console.log` in your code to see the raw HTML or error snippets.
- Set `timeoutMs` higher for slow servers.
- Use `sendReferer` / `sendOrigin` options if the server rejects requests without those headers.
- Inspect the cached session file: `cat ~/.cache/libts-csrfx-auth/session.json`.
- Use `AuthError.getFormattedMessage()` for detailed error logs.

---

## Contributing

1. **Fork** the repository.
2. **Create a feature branch** (`git checkout -b feat/your-feature`).
3. **Commit** using [Conventional Commits](https://www.conventionalcommits.org/) (e.g., `feat: add new retry predicate`).
4. **Run** `bun run rebuild` to ensure formatting, typecheck, and tests pass.
5. **Push** and **open a Pull Request** against `main`.

All contributions must pass the existing test suite and maintain 100% type coverage. New features should include tests.

---

## License

**AGPL-3.0-only** – see [LICENSE](license) for details.  
This license ensures that any network‑distributed modifications remain open source.

---

## Credits

- Built with [TypeScript](https://www.typescriptlang.org) and [Bun](https://bun.sh).
- Inspired by the need for a lightweight, type‑safe authentication client for web scraping and automation.

---

> **Repository**: https://github.com/neuxdotdev/libts-csrfx-auth  
> **Issues**: https://github.com/neuxdotdev/libts-csrfx-auth/issues  
> **npm**: https://www.npmjs.com/package/libts-csrfx-auth  
> **Documentation**: https://neuxdotdev.github.io/libts-csrfx-auth/
