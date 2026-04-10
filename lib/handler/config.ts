/**
 * @fileoverview Configuration management for authentication.
 * Loads and validates environment variables, constructs URLs, and provides
 * typed access to credentials and endpoint paths.
 *
 * @module handler/config
 * @public
 */

import { loadEnv } from './env.js'

/**
 * Type alias for the environment variables object returned by {@link loadEnv}.
 *
 * @remarks
 * This type is re-exported from `./env.js` and represents the raw validated
 * environment variables including `BASE_URL`, optional `LOGIN_PATH`, `LOGOUT_PATH`,
 * `USER_EMAIL`, and `USER_PASSWORD`.
 *
 * @public
 * @since 0.1.1
 * @see {@link loadEnv}
 * @see {@link EnvConfig}
 */
export type { EnvVars } from './env.js'

/**
 * Loads environment variables from a `.env` file and/or the current process environment.
 *
 * @remarks
 * This function reads environment variables using a predefined set of keys relevant to
 * authentication configuration. The exact behavior (e.g., precedence of `.env` over
 * system environment) depends on the implementation in `env.js`.
 *
 * @returns An object containing the loaded environment variables, typed as {@link EnvVars}.
 * @throws May throw file system errors if `.env` exists but cannot be read.
 *
 * @example
 * // Load environment variables
 * const env = loadEnv();
 * console.log(env.BASE_URL); // "https://api.example.com"
 *
 * @public
 * @since 0.1.1
 * @see {@link EnvConfig.fromEnv}
 */
export { loadEnv } from './env.js'

/**
 * Options for creating an {@link EnvConfig} instance.
 *
 * All fields are optional except `baseUrl`. If optional fields are omitted,
 * the configuration will use sensible defaults or fall back to environment
 * variables loaded via {@link loadEnv}.
 *
 * @remarks
 * - `loginPath` and `logoutPath` must not contain `?` or `#` and cannot be empty strings.
 * - `email` must be a valid email format if provided.
 * - `password` cannot be an empty string if provided.
 *
 * @public
 * @since 0.1.1
 */
export interface EnvConfigOptions {
	/**
	 * Base URL of the target server (e.g., `https://example.com`).
	 * Must be a valid HTTP or HTTPS URL. Trailing slashes are automatically removed.
	 *
	 * @remarks
	 * This field is required. The URL is normalized by trimming whitespace and
	 * stripping any trailing slash. An invalid URL will cause the constructor to throw.
	 *
	 * @example "https://api.example.com"
	 */
	baseUrl: string

	/**
	 * Path to the login endpoint, relative to `baseUrl`.
	 *
	 * @defaultValue "login"
	 * @remarks
	 * Must not contain query or fragment characters (`?` or `#`).
	 * Leading slashes are automatically removed. Empty string is forbidden.
	 */
	loginPath?: string

	/**
	 * Path to the logout endpoint, relative to `baseUrl`.
	 *
	 * @defaultValue "logout"
	 * @remarks
	 * Must not contain query or fragment characters (`?` or `#`).
	 * Leading slashes are automatically removed. Empty string is forbidden.
	 */
	logoutPath?: string

	/**
	 * User email address for authentication.
	 *
	 * @remarks
	 * If provided, it must be a valid email format (basic regex validation).
	 * An empty string is treated as omitted, resulting in an empty string stored.
	 */
	email?: string

	/**
	 * User password for authentication.
	 *
	 * @remarks
	 * If provided, it cannot be an empty string. No other validation is performed.
	 * An empty string is only allowed when the field is omitted entirely.
	 */
	password?: string
}

/**
 * Validated and normalized configuration for authentication clients.
 *
 * This class takes raw options (or environment variables) and ensures that:
 * - The base URL is a valid HTTP/HTTPS URL, with trailing slashes stripped.
 * - Paths are sanitized (leading slashes removed) and do not contain illegal characters.
 * - Email addresses are syntactically valid.
 * - Empty or malformed inputs throw descriptive errors.
 *
 * @example
 * // Direct construction
 * const config = new EnvConfig({
 *   baseUrl: 'https://example.com',
 *   loginPath: 'signin',
 *   email: 'user@example.com',
 *   password: 'secret'
 * });
 *
 * console.log(config.fullLoginUrl); // "https://example.com/signin"
 *
 * @example
 * // Load from environment variables
 * const configFromEnv = EnvConfig.fromEnv();
 * if (configFromEnv.hasValidCredentials()) {
 *   await login(configFromEnv);
 * }
 *
 * @example
 * // Override environment with explicit options
 * const overridden = EnvConfig.fromEnv({ email: 'test@example.org' });
 *
 * @public
 * @since 0.1.1
 * @see {@link EnvConfigOptions}
 * @see {@link loadEnv}
 */
export class EnvConfig {
	/**
	 * Normalized base URL (no trailing slash).
	 *
	 * @example "https://api.example.com"
	 */
	readonly baseUrl: string

	/**
	 * Sanitized login path (no leading slash).
	 *
	 * @defaultValue "login"
	 * @example "login"
	 */
	readonly loginPath: string

	/**
	 * Sanitized logout path (no leading slash).
	 *
	 * @defaultValue "logout"
	 * @example "logout"
	 */
	readonly logoutPath: string

	/**
	 * User email address. May be empty string if not provided.
	 *
	 * @remarks
	 * If the email was provided in the constructor options, it is validated against a basic email pattern.
	 * An empty string indicates that no email was supplied (or an empty string was explicitly given, which is treated as omitted).
	 */
	readonly email: string

	/**
	 * User password. May be empty string if not provided.
	 *
	 * @remarks
	 * An empty string indicates that no password was supplied. If a password is provided, it cannot be an empty string.
	 * No other validation is performed.
	 */
	readonly password: string

	/**
	 * Creates a new EnvConfig instance after validating and normalizing all inputs.
	 *
	 * @param options - Configuration options (must include `baseUrl`).
	 * @throws {Error} If `baseUrl` is missing, empty, or not a valid HTTP/HTTPS URL.
	 * @throws {Error} If `loginPath` or `logoutPath` is an empty string or contains `?` or `#`.
	 * @throws {Error} If `email` is provided but is not a valid email address.
	 * @throws {Error} If `password` is provided as an empty string.
	 *
	 * @remarks
	 * - Trailing slashes are stripped from `baseUrl`.
	 * - Leading slashes are stripped from `loginPath` and `logoutPath`.
	 * - Empty `email` or `password` strings are stored as empty strings (no validation).
	 *
	 * @example
	 * const config = new EnvConfig({
	 *   baseUrl: 'https://example.com',
	 *   loginPath: 'api/login',
	 *   email: 'admin@example.com',
	 *   password: 'secure123'
	 * });
	 */
	constructor(options: EnvConfigOptions) {
		// Validate baseUrl
		if (!options.baseUrl || typeof options.baseUrl !== 'string') {
			throw new Error('EnvConfig: baseUrl is required and must be a string')
		}
		let cleanBaseUrl = options.baseUrl.trim()
		if (cleanBaseUrl === '') {
			throw new Error('EnvConfig: baseUrl cannot be empty')
		}
		const urlPattern = /^https?:\/\/[^\s/$.?#].[^\s]*$/i
		if (!urlPattern.test(cleanBaseUrl)) {
			throw new Error(
				`EnvConfig: baseUrl must be a valid HTTP/HTTPS URL (got: ${cleanBaseUrl})`,
			)
		}
		this.baseUrl = cleanBaseUrl.replace(/\/+$/, '')

		// Validate loginPath
		const rawLoginPath = options.loginPath?.trim()
		if (rawLoginPath !== undefined) {
			if (rawLoginPath === '') {
				throw new Error('EnvConfig: loginPath cannot be empty string')
			}
			if (/[?#]/.test(rawLoginPath)) {
				throw new Error(
					`EnvConfig: loginPath must not contain ? or # (got: ${rawLoginPath})`,
				)
			}
		}
		this.loginPath = rawLoginPath?.replace(/^\/+/, '') ?? 'login'

		// Validate logoutPath
		const rawLogoutPath = options.logoutPath?.trim()
		if (rawLogoutPath !== undefined) {
			if (rawLogoutPath === '') {
				throw new Error('EnvConfig: logoutPath cannot be empty string')
			}
			if (/[?#]/.test(rawLogoutPath)) {
				throw new Error(
					`EnvConfig: logoutPath must not contain ? or # (got: ${rawLogoutPath})`,
				)
			}
		}
		this.logoutPath = rawLogoutPath?.replace(/^\/+/, '') ?? 'logout'

		// Validate email
		const rawEmail = options.email?.trim()
		if (rawEmail !== undefined && rawEmail !== '') {
			const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
			if (!emailPattern.test(rawEmail)) {
				throw new Error(`EnvConfig: email must be a valid email address (got: ${rawEmail})`)
			}
			this.email = rawEmail
		} else {
			this.email = rawEmail ?? ''
		}

		// Validate password
		const rawPassword = options.password?.trim()
		if (rawPassword !== undefined && rawPassword === '') {
			throw new Error('EnvConfig: password cannot be empty string if provided')
		}
		this.password = rawPassword ?? ''
	}

	/**
	 * Returns the fully constructed login URL.
	 *
	 * @returns The complete login endpoint URL (baseUrl + loginPath).
	 *
	 * @example
	 * // baseUrl = "https://example.com", loginPath = "login"
	 * config.fullLoginUrl === "https://example.com/login"
	 */
	get fullLoginUrl(): string {
		return `${this.baseUrl}/${this.loginPath}`
	}

	/**
	 * Returns the fully constructed logout URL.
	 *
	 * @returns The complete logout endpoint URL (baseUrl + logoutPath).
	 *
	 * @example
	 * // baseUrl = "https://example.com", logoutPath = "logout"
	 * config.fullLogoutUrl === "https://example.com/logout"
	 */
	get fullLogoutUrl(): string {
		return `${this.baseUrl}/${this.logoutPath}`
	}

	/**
	 * Creates an EnvConfig instance from environment variables (`.env` or process/Bun.env),
	 * with optional overrides.
	 *
	 * This static method calls {@link loadEnv} to read the environment, then applies
	 * any overrides provided. It is the recommended way to instantiate configuration
	 * in a production application.
	 *
	 * @param overrides - Partial options that take precedence over environment variables.
	 * @returns A fully validated EnvConfig instance.
	 * @throws {Error} If `BASE_URL` is not set in environment and not overridden.
	 *
	 * @example
	 * // Uses BASE_URL, LOGIN_PATH, USER_EMAIL, USER_PASSWORD from .env
	 * const config = EnvConfig.fromEnv();
	 *
	 * @example
	 * // Override email and password while keeping baseUrl from env
	 * const config = EnvConfig.fromEnv({
	 *   email: 'temp@example.com',
	 *   password: 'temp123'
	 * });
	 *
	 * @public
	 * @since 0.1.1
	 * @see {@link loadEnv}
	 */
	static fromEnv(overrides?: Partial<EnvConfigOptions>): EnvConfig {
		const env = loadEnv()
		if (!env.BASE_URL || typeof env.BASE_URL !== 'string') {
			throw new Error('EnvConfig.fromEnv: BASE_URL environment variable is required')
		}

		const opts: EnvConfigOptions = {
			baseUrl: overrides?.baseUrl ?? env.BASE_URL,
		}

		if (overrides?.loginPath !== undefined) {
			opts.loginPath = overrides.loginPath
		} else if (env.LOGIN_PATH !== undefined) {
			opts.loginPath = env.LOGIN_PATH
		}

		if (overrides?.logoutPath !== undefined) {
			opts.logoutPath = overrides.logoutPath
		} else if (env.LOGOUT_PATH !== undefined) {
			opts.logoutPath = env.LOGOUT_PATH
		}

		if (overrides?.email !== undefined) {
			opts.email = overrides.email
		} else if (env.USER_EMAIL !== undefined) {
			opts.email = env.USER_EMAIL
		}

		if (overrides?.password !== undefined) {
			opts.password = overrides.password
		} else if (env.USER_PASSWORD !== undefined) {
			opts.password = env.USER_PASSWORD
		}

		return new EnvConfig(opts)
	}

	/**
	 * Checks whether the stored credentials are likely usable.
	 *
	 * @returns `true` if both `email` and `password` are non‑empty strings and
	 *          the email contains an `@` symbol (basic validity), otherwise `false`.
	 *
	 * @remarks
	 * This is a lightweight sanity check; it does not attempt to verify the
	 * credentials against the server.
	 *
	 * @example
	 * if (!config.hasValidCredentials()) {
	 *   console.warn('Credentials missing or invalid');
	 * }
	 */
	hasValidCredentials(): boolean {
		return this.email !== '' && this.password !== '' && this.email.includes('@')
	}
}
