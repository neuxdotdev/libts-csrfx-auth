/**
 * @fileoverview Central export point for the handler module.
 *
 * This module aggregates and re‑exports all public APIs from the configuration
 * and error submodules. It provides a clean, single‑entry interface for consumers
 * who need environment loading, configuration validation, and error handling
 * without pulling in the entire authentication client.
 *
 * @module handler/index
 * @public
 */

// Re-export configuration-related items
export {
	/**
	 * Validated configuration class for authentication endpoints and credentials.
	 *
	 * @remarks
	 * This class normalizes and validates base URLs, login/logout paths,
	 * and user credentials from either explicit options or environment variables.
	 *
	 * @see {@link EnvConfig}
	 * @since 0.1.1
	 */
	EnvConfig,

	/**
	 * Options for constructing an {@link EnvConfig} instance.
	 *
	 * @remarks
	 * All fields except `baseUrl` are optional. When omitted, sensible defaults
	 * or environment variables (via {@link loadEnv}) are used.
	 *
	 * @see {@link EnvConfigOptions}
	 * @since 0.1.1
	 */
	type EnvConfigOptions,

	/**
	 * Raw environment variable interface as returned by {@link loadEnv}.
	 *
	 * @remarks
	 * This type represents the validated shape of environment variables after
	 * loading from `.env` and `Bun.env`. Only `BASE_URL` is guaranteed to be present.
	 *
	 * @see {@link EnvVars}
	 * @since 0.1.1
	 */
	type EnvVars,

	/**
	 * Loads and validates environment variables from `.env` file and `Bun.env`.
	 *
	 * @remarks
	 * This function reads configuration from the project root's `.env` file
	 * (if present) and falls back to runtime environment variables. It performs
	 * validation on `BASE_URL`, `LOGIN_PATH`, `LOGOUT_PATH`, `USER_EMAIL`, and
	 * `USER_PASSWORD`.
	 *
	 * @throws {Error} If required variables are missing or malformed.
	 * @returns A validated {@link EnvVars} object.
	 *
	 * @see {@link loadEnv}
	 * @since 0.1.1
	 */
	loadEnv,
} from './config.js'

// Re-export error-related items
export {
	/**
	 * Standard error class for all authentication failures.
	 *
	 * @remarks
	 * Extends the built-in `Error` with a typed error code, optional context,
	 * and timestamp. Provides static factories for creating instances from
	 * HTTP responses, unknown errors, or raw status codes.
	 *
	 * @see {@link AuthError}
	 * @see {@link AuthErrorCode}
	 * @since 0.1.1
	 */
	AuthError,

	/**
	 * Immutable object containing all possible error code strings.
	 *
	 * @remarks
	 * Use these constants to compare against the `code` property of an
	 * {@link AuthError}. The object is frozen and cannot be modified.
	 *
	 * @example
	 * if (error.code === AuthErrorCode.NETWORK_ERROR) {
	 *   // retry logic
	 * }
	 *
	 * @see {@link AuthErrorCode}
	 * @since 0.1.1
	 */
	AuthErrorCode,

	/**
	 * Type alias for any valid authentication error code.
	 *
	 * @remarks
	 * This is a union type of all string values from the {@link AuthErrorCode} object.
	 * Useful for type‑safe error code handling.
	 *
	 * @example
	 * function handleError(code: AuthErrorCodeType) {
	 *   // code is one of the predefined strings
	 * }
	 *
	 * @see {@link AuthErrorCode}
	 * @since 0.1.1
	 */
	type AuthErrorCode as AuthErrorCodeType,
} from './error.js'
