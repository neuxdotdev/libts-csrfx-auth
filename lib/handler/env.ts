/**
 * @fileoverview Environment variable loader with .env file support and validation.
 * Reads configuration from a `.env` file in the project root (two levels up from this
 * file) and falls back to `Bun.env` (or `process.env` when using Node.js). Provides
 * validation for required variables, URL format, email syntax, and path restrictions.
 *
 * @module handler/env
 * @0.1.1
 */

import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Environment variables required or optionally used by the authentication library.
 *
 * @remarks
 * Only `BASE_URL` is mandatory. All other fields are optional but may be required
 * by specific clients (e.g., `{@link AuthClient}` needs `USER_EMAIL` and `USER_PASSWORD`).
 *
 * @example
 * // Minimal valid EnvVars
 * { BASE_URL: "https://example.com" }
 *
 * @example
 * // Full configuration
 * {
 *   BASE_URL: "https://example.com",
 *   LOGIN_PATH: "signin",
 *   LOGOUT_PATH: "signout",
 *   USER_EMAIL: "admin@example.com",
 *   USER_PASSWORD: "secret123"
 * }
 *
 * @0.1.1
 * @since 0.1.1
 * @see {@link loadEnv}
 * @see {@link EnvConfig}
 */
export interface EnvVars {
	/**
	 * Base URL of the target server.
	 *
	 * @remarks
	 * Must be a valid HTTP or HTTPS URL (e.g., `http://localhost:3000` or `https://api.example.com`).
	 * This field is **required**; if missing, {@link loadEnv} will throw an error.
	 */
	BASE_URL: string

	/**
	 * Path to the login endpoint, relative to `BASE_URL`.
	 *
	 * @defaultValue "login"
	 * @remarks
	 * If provided, it must not be an empty string and must not contain `?` or `#`.
	 * Leading slashes are automatically removed by {@link EnvConfig}.
	 */
	LOGIN_PATH?: string

	/**
	 * Path to the logout endpoint, relative to `BASE_URL`.
	 *
	 * @defaultValue "logout"
	 * @remarks
	 * If provided, it must not be an empty string and must not contain `?` or `#`.
	 * Leading slashes are automatically removed by {@link EnvConfig}.
	 */
	LOGOUT_PATH?: string

	/**
	 * User email address for authentication.
	 *
	 * @remarks
	 * If provided and non‑empty, it must be a syntactically valid email address
	 * (basic format `local@domain.tld`). Empty strings are treated as omitted.
	 */
	USER_EMAIL?: string

	/**
	 * User password for authentication.
	 *
	 * @remarks
	 * If provided, it cannot be an empty string. No other validation is performed.
	 */
	USER_PASSWORD?: string
}

// Determine the project root directory (two levels up from this file: lib/handler/env.ts → root)
const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..', '..')

/**
 * Parses a `.env` file content into a key‑value record.
 *
 * @param content - Raw string content of the `.env` file.
 * @returns Record of key‑value pairs.
 *
 * @remarks
 * Supports:
 * - Comments (lines starting with `#`)
 * - Empty lines
 * - Quotes removal (both `"` and `'`) around values
 * - Trimming whitespace around keys and values
 *
 * @example
 * const env = parseEnvFile('BASE_URL=https://example.com\nUSER_EMAIL="test@x.com"');
 * // { BASE_URL: "https://example.com", USER_EMAIL: "test@x.com" }
 *
 * @internal
 */
function parseEnvFile(content: string): Record<string, string> {
	const parsed: Record<string, string> = {}
	for (const rawLine of content.split('\n')) {
		const trimmed = rawLine.trim()
		if (!trimmed || trimmed.startsWith('#')) continue
		const eqIdx = trimmed.indexOf('=')
		if (eqIdx === -1) continue
		const key = trimmed.slice(0, eqIdx).trim()
		if (!key) continue
		let value = trimmed.slice(eqIdx + 1).trim()
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1)
		}
		parsed[key] = value
	}
	return parsed
}

/**
 * Validates that a string is a proper HTTP or HTTPS URL.
 *
 * @param url - The URL string to validate.
 * @returns `true` if the URL uses `http:` or `https:` protocol and can be parsed.
 *
 * @internal
 */
function isValidUrl(url: string): boolean {
	try {
		const parsed = new URL(url)
		return parsed.protocol === 'http:' || parsed.protocol === 'https:'
	} catch {
		return false
	}
}

/**
 * Validates an email address using a simple regex pattern.
 *
 * @param email - The email string to validate.
 * @returns `true` if the email matches the pattern `local@domain.tld`.
 *
 * @internal
 */
function isValidEmail(email: string): boolean {
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
	return emailRegex.test(email)
}

/**
 * Loads environment variables from the project's `.env` file and `Bun.env`.
 *
 * @returns A validated {@link EnvVars} object.
 *
 * @throws {Error} If `BASE_URL` is missing from both `.env` and environment.
 * @throws {Error} If `BASE_URL` is not a valid HTTP/HTTPS URL.
 * @throws {Error} If `LOGIN_PATH` is an empty string or contains `?` or `#`.
 * @throws {Error} If `LOGOUT_PATH` is an empty string or contains `?` or `#`.
 * @throws {Error} If `USER_EMAIL` is provided but has an invalid format.
 * @throws {Error} If `USER_PASSWORD` is explicitly set to an empty string.
 *
 * @remarks
 * The function looks for a `.env` file in the project root directory (two levels
 * above this file). If the file exists, its variables are parsed and **take precedence**
 * over any pre‑existing environment variables. Then it reads from `Bun.env`
 * (or falls back to `process.env` when not in Bun).
 *
 * The following validation is performed:
 * - `BASE_URL` must be present and be a valid HTTP/HTTPS URL.
 * - `LOGIN_PATH` and `LOGOUT_PATH` cannot be empty strings and must not contain `?` or `#`.
 * - `USER_EMAIL` must be a valid email format if provided and non‑empty.
 * - `USER_PASSWORD` cannot be an empty string if provided.
 *
 * @example
 * // .env file contains:
 * // BASE_URL=http://localhost:3000
 * // USER_EMAIL=admin@example.com
 * const env = loadEnv();
 * console.log(env.BASE_URL); // "http://localhost:3000"
 * console.log(env.USER_EMAIL); // "admin@example.com"
 *
 * @example
 * // Environment variables override .env (if any)
 * process.env.BASE_URL = "https://prod.example.com";
 * const env = loadEnv(); // uses the environment variable
 *
 * @0.1.1
 * @since 0.1.1
 * @see {@link EnvConfig.fromEnv}
 * @see {@link EnvVars}
 */
export function loadEnv(): EnvVars {
	const envPath = join(rootDir, '.env')
	let fileVars: Record<string, string> = {}
	if (existsSync(envPath)) {
		const content = readFileSync(envPath, 'utf8')
		fileVars = parseEnvFile(content)
	}

	// Bun environment (falls back to process.env in Node)
	const bunEnv: Record<string, string | undefined> = Bun.env

	const baseUrl = fileVars['BASE_URL'] ?? bunEnv['BASE_URL'] ?? ''
	if (!baseUrl) {
		throw new Error(
			'EnvVars: BASE_URL is required but not set in .env or environment variables',
		)
	}
	if (!isValidUrl(baseUrl)) {
		throw new Error(`EnvVars: BASE_URL must be a valid HTTP/HTTPS URL (got: ${baseUrl})`)
	}

	let loginPath = fileVars['LOGIN_PATH'] ?? bunEnv['LOGIN_PATH']
	if (loginPath !== undefined) {
		const trimmed = loginPath.trim()
		if (trimmed === '') {
			throw new Error('EnvVars: LOGIN_PATH cannot be empty string if provided')
		}
		if (/[?#]/.test(trimmed)) {
			throw new Error(`EnvVars: LOGIN_PATH must not contain ? or # (got: ${trimmed})`)
		}
		loginPath = trimmed
	}

	let logoutPath = fileVars['LOGOUT_PATH'] ?? bunEnv['LOGOUT_PATH']
	if (logoutPath !== undefined) {
		const trimmed = logoutPath.trim()
		if (trimmed === '') {
			throw new Error('EnvVars: LOGOUT_PATH cannot be empty string if provided')
		}
		if (/[?#]/.test(trimmed)) {
			throw new Error(`EnvVars: LOGOUT_PATH must not contain ? or # (got: ${trimmed})`)
		}
		logoutPath = trimmed
	}

	let userEmail = fileVars['USER_EMAIL'] ?? bunEnv['USER_EMAIL']
	if (userEmail !== undefined) {
		const trimmed = userEmail.trim()
		if (trimmed !== '') {
			if (!isValidEmail(trimmed)) {
				throw new Error(
					`EnvVars: USER_EMAIL must be a valid email address (got: ${trimmed})`,
				)
			}
			userEmail = trimmed
		} else {
			userEmail = undefined
		}
	}

	let userPassword = fileVars['USER_PASSWORD'] ?? bunEnv['USER_PASSWORD']
	if (userPassword !== undefined) {
		const trimmed = userPassword.trim()
		if (trimmed === '') {
			throw new Error('EnvVars: USER_PASSWORD cannot be empty string if provided')
		}
		userPassword = trimmed
	}

	const result: EnvVars = {
		BASE_URL: baseUrl,
	}
	if (loginPath !== undefined) result.LOGIN_PATH = loginPath
	if (logoutPath !== undefined) result.LOGOUT_PATH = logoutPath
	if (userEmail !== undefined) result.USER_EMAIL = userEmail
	if (userPassword !== undefined) result.USER_PASSWORD = userPassword
	return result
}
