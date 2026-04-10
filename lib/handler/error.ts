/**
 * @fileoverview Centralized error handling for authentication flows.
 * Provides a typed error hierarchy with HTTP status mapping, retry detection,
 * and serialization utilities. All authentication-related errors flow through
 * this module to ensure consistent logging and recovery logic.
 *
 * @module handler/error
 * @public
 */

/**
 * Standard error codes for authentication operations.
 *
 * Each code represents a distinct failure mode that can be used to drive
 * conditional retries, user messaging, or fallback behavior.
 *
 * @remarks
 * - `NETWORK_ERROR`, `TIMEOUT`, `SERVER_ERROR`, `TOO_MANY_REQUESTS` are considered
 *   retryable by {@link isRetryableError}.
 * - `INVALID_CREDENTIALS`, `CSRF_EXPIRED`, `NOT_AUTHENTICATED`, `UNAUTHORIZED`,
 *   `FORBIDDEN` are considered authentication failures by {@link isAuthenticationError}.
 *
 * @public
 * @since 0.1.1
 */
export const AuthErrorCode = {
	/** Email or password format invalid or mismatch. */
	INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
	/** CSRF token missing from HTML or API response. */
	CSRF_NOT_FOUND: 'CSRF_NOT_FOUND',
	/** Failed to fetch CSRF token due to network or server error. */
	CSRF_FETCH_FAILED: 'CSRF_FETCH_FAILED',
	/** CSRF token expired (HTTP 419). */
	CSRF_EXPIRED: 'CSRF_EXPIRED',
	/** Login request succeeded HTTP but server returned non‑success status. */
	LOGIN_FAILED: 'LOGIN_FAILED',
	/** Logout request failed after session existed. */
	LOGOUT_FAILED: 'LOGOUT_FAILED',
	/** No active session found in cache or server rejected it. */
	NOT_AUTHENTICATED: 'NOT_AUTHENTICATED',
	/** Network connectivity error (DNS, TLS, socket). */
	NETWORK_ERROR: 'NETWORK_ERROR',
	/** Request timeout exceeded. */
	TIMEOUT: 'TIMEOUT',
	/** File system cache read/write failure. */
	CACHE_ERROR: 'CACHE_ERROR',
	/** Request validation failed (HTTP 400/422). */
	VALIDATION_ERROR: 'VALIDATION_ERROR',
	/** Rate limiting triggered (HTTP 429). */
	TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
	/** Server internal error (HTTP 5xx). */
	SERVER_ERROR: 'SERVER_ERROR',
	/** HTTP 401 – Unauthorized. */
	UNAUTHORIZED: 'UNAUTHORIZED',
	/** HTTP 403 – Forbidden. */
	FORBIDDEN: 'FORBIDDEN',
	/** HTTP 404 – Not Found. */
	NOT_FOUND: 'NOT_FOUND',
	/** Catch‑all for unexpected errors. */
	UNKNOWN: 'UNKNOWN',
} as const

/**
 * Union type of all possible authentication error codes.
 *
 * @example
 * function handleError(code: AuthErrorCode) {
 *   if (code === AuthErrorCode.NETWORK_ERROR) retry();
 * }
 *
 * @public
 * @since 0.1.1
 */
export type AuthErrorCode = (typeof AuthErrorCode)[keyof typeof AuthErrorCode]

/**
 * Internal mapping from HTTP status codes to the most appropriate AuthErrorCode.
 * Used by {@link AuthError.fromResponse} and {@link AuthError.fromStatus}.
 *
 * @internal
 */
const HTTP_STATUS_CODE_MAP: Readonly<Record<number, AuthErrorCode>> = {
	400: AuthErrorCode.VALIDATION_ERROR,
	401: AuthErrorCode.UNAUTHORIZED,
	403: AuthErrorCode.FORBIDDEN,
	404: AuthErrorCode.NOT_FOUND,
	419: AuthErrorCode.CSRF_EXPIRED,
	422: AuthErrorCode.VALIDATION_ERROR,
	429: AuthErrorCode.TOO_MANY_REQUESTS,
	500: AuthErrorCode.SERVER_ERROR,
	502: AuthErrorCode.SERVER_ERROR,
	503: AuthErrorCode.SERVER_ERROR,
	504: AuthErrorCode.SERVER_ERROR,
}

/**
 * Determines if an error is safe to retry.
 *
 * @param error - The AuthError instance to evaluate.
 * @returns `true` if the error indicates a transient condition (network, timeout,
 *          server error, or rate limiting), otherwise `false`.
 *
 * @remarks
 * Retryable errors are those that may succeed on a subsequent attempt without
 * changing the request or credentials. Non‑retryable errors (e.g., invalid
 * credentials, CSRF expired) require user intervention or state reset.
 *
 * @example
 * try {
 *   await auth.login();
 * } catch (err) {
 *   if (isRetryableError(err)) {
 *     await delay(1000);
 *     return auth.login();
 *   }
 *   throw err;
 * }
 *
 * @public
 * @since 0.1.1
 * @see {@link AuthErrorCode}
 */
export function isRetryableError(error: AuthError): boolean {
	const retryableCodes: AuthErrorCode[] = [
		AuthErrorCode.NETWORK_ERROR,
		AuthErrorCode.TIMEOUT,
		AuthErrorCode.SERVER_ERROR,
		AuthErrorCode.TOO_MANY_REQUESTS,
	]
	return retryableCodes.includes(error.code)
}

/**
 * Determines if an error is related to authentication failure.
 *
 * @param error - The AuthError instance to evaluate.
 * @returns `true` if the error indicates invalid credentials, expired CSRF,
 *          missing session, or insufficient permissions, otherwise `false`.
 *
 * @remarks
 * Authentication errors typically require the application to re‑authenticate
 * (e.g., redirect to login page, clear cached session).
 *
 * @example
 * if (isAuthenticationError(err)) {
 *   redirectToLoginPage();
 * }
 *
 * @public
 * @since 0.1.1
 * @see {@link AuthErrorCode}
 */
export function isAuthenticationError(error: AuthError): boolean {
	const authCodes: AuthErrorCode[] = [
		AuthErrorCode.INVALID_CREDENTIALS,
		AuthErrorCode.CSRF_EXPIRED,
		AuthErrorCode.NOT_AUTHENTICATED,
		AuthErrorCode.UNAUTHORIZED,
		AuthErrorCode.FORBIDDEN,
	]
	return authCodes.includes(error.code)
}

/**
 * Standard error class for all authentication operations.
 *
 * Extends the built-in `Error` and adds a typed error code, an optional context
 * string, and a timestamp. Instances are frozen to prevent accidental mutation.
 *
 * @remarks
 * - Use static factories {@link AuthError.fromResponse}, {@link AuthError.fromUnknown}, and
 *   {@link AuthError.fromStatus} to create instances consistently.
 * - The `toJSON()` method provides a safe serialization for logging.
 * - `getFormattedMessage()` returns a human‑readable string with code, context,
 *   and cause.
 *
 * @example
 * try {
 *   throw new AuthError('Login failed', AuthErrorCode.LOGIN_FAILED, {
 *     cause: response,
 *     context: 'POST /login'
 *   });
 * } catch (e) {
 *   console.error(e.getFormattedMessage());
 * }
 *
 * @public
 * @since 0.1.1
 */
export class AuthError extends Error {
	/**
	 * Machine‑readable error code.
	 *
	 * @see {@link AuthErrorCode}
	 */
	readonly code: AuthErrorCode

	/**
	 * Optional additional context (e.g., URL, request ID, snippet).
	 * Automatically trimmed.
	 */
	readonly context?: string | undefined

	/**
	 * Unix timestamp (milliseconds) when the error was created.
	 */
	readonly timestamp: number

	/**
	 * Creates a new AuthError.
	 *
	 * @param message - Human‑readable error description (must be non‑empty string).
	 * @param code - One of the predefined {@link AuthErrorCode} values.
	 * @param options - Optional additional data.
	 * @param options.cause - Underlying error or response object.
	 * @param options.context - Short contextual string (will be trimmed).
	 *
	 * @throws {TypeError} If `message` is empty or not a string, or if `code` is invalid.
	 *
	 * @example
	 * new AuthError('CSRF token expired', AuthErrorCode.CSRF_EXPIRED, {
	 *   context: 'GET /login',
	 *   cause: previousError
	 * });
	 */
	constructor(
		message: string,
		code: AuthErrorCode,
		options?: { cause?: unknown; context?: string },
	) {
		if (!message || typeof message !== 'string') {
			throw new TypeError('AuthError: message must be a non-empty string')
		}
		if (!code || !Object.values(AuthErrorCode).includes(code)) {
			throw new TypeError(`AuthError: invalid error code "${String(code)}"`)
		}
		super(message, { cause: options?.cause })
		this.name = 'AuthError'
		this.code = code
		this.context = options?.context?.trim() || undefined
		this.timestamp = Date.now()
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, AuthError)
		}
		Object.freeze(this)
	}

	/**
	 * Creates an AuthError from a `fetch` Response object.
	 *
	 * Maps the HTTP status code to an appropriate error code using
	 * {@link HTTP_STATUS_CODE_MAP}, falling back to `defaultCode` if no mapping exists.
	 * The error message includes the status and statusText, plus an optional context
	 * snippet.
	 *
	 * @param response - The Response object from a failed fetch.
	 * @param defaultCode - Fallback error code when no HTTP mapping is available.
	 * @param options - Optional context string.
	 *
	 * @returns A new AuthError instance.
	 *
	 * @throws {TypeError} If `response` is not a valid Response object or status is out of range.
	 *
	 * @example
	 * const res = await fetch('/api/login');
	 * if (!res.ok) {
	 *   throw AuthError.fromResponse(res, AuthErrorCode.LOGIN_FAILED, {
	 *     context: 'login attempt'
	 *   });
	 * }
	 *
	 * @public
	 * @since 0.1.1
	 */
	static fromResponse(
		response: Response,
		defaultCode: AuthErrorCode,
		options?: { context?: string },
	): AuthError {
		if (!(response instanceof Response)) {
			throw new TypeError('AuthError.fromResponse: expected Response object')
		}
		const status = response.status
		if (typeof status !== 'number' || status < 100 || status > 599) {
			throw new TypeError(`Invalid HTTP status code: ${status}`)
		}
		const code = HTTP_STATUS_CODE_MAP[status] ?? defaultCode
		let message = `HTTP ${status}: ${response.statusText || 'Unknown status'}`
		if (options?.context) {
			message += ` (${options.context.slice(0, 100)})`
		}
		return new AuthError(message, code, {
			cause: response,
			...(options?.context && { context: options.context }),
		})
	}

	/**
	 * Creates an AuthError from any unknown error value.
	 *
	 * Intelligently extracts a message and code based on error type:
	 * - `DOMException` with `AbortError` → `TIMEOUT`
	 * - `TypeError` with `fetch` in message → `NETWORK_ERROR`
	 * - Generic `Error` → inspects message for keywords "csrf", "network", "timeout"
	 * - String → uses first 200 characters
	 *
	 * @param err - The unknown error value (exception, string, etc.).
	 * @param fallbackCode - Code to use if none can be inferred (default: `UNKNOWN`).
	 * @returns A properly constructed AuthError.
	 *
	 * @example
	 * try {
	 *   await fetch(...);
	 * } catch (err) {
	 *   throw AuthError.fromUnknown(err);
	 * }
	 *
	 * @public
	 * @since 0.1.1
	 */
	static fromUnknown(
		err: unknown,
		fallbackCode: AuthErrorCode = AuthErrorCode.UNKNOWN,
	): AuthError {
		if (err instanceof AuthError) return err
		let message = 'Unknown error'
		let code = fallbackCode
		if (err instanceof DOMException && err.name === 'AbortError') {
			message = 'Request timed out'
			code = AuthErrorCode.TIMEOUT
		} else if (err instanceof TypeError && err.message.includes('fetch')) {
			message = 'Network error – check connectivity'
			code = AuthErrorCode.NETWORK_ERROR
		} else if (err instanceof Error) {
			message = err.message
			if (message.toLowerCase().includes('csrf')) {
				code = AuthErrorCode.CSRF_NOT_FOUND
			} else if (message.toLowerCase().includes('network')) {
				code = AuthErrorCode.NETWORK_ERROR
			} else if (message.toLowerCase().includes('timeout')) {
				code = AuthErrorCode.TIMEOUT
			}
		} else if (typeof err === 'string') {
			message = err.slice(0, 200)
		}
		return new AuthError(message, code, { cause: err })
	}

	/**
	 * Creates an AuthError from a raw HTTP status code and optional response body.
	 *
	 * Useful when you have only the status code and a text snippet (e.g., from a
	 * failed XMLHttpRequest or a non‑standard response).
	 *
	 * @param status - HTTP status code (100‑599).
	 * @param body - Optional response body (first line, first 100 chars used).
	 *
	 * @returns A new AuthError instance.
	 *
	 * @throws {TypeError} If status is out of valid range.
	 *
	 * @example
	 * throw AuthError.fromStatus(419, 'CSRF token mismatch');
	 *
	 * @public
	 * @since 0.1.1
	 */
	static fromStatus(status: number, body?: string): AuthError {
		if (typeof status !== 'number' || status < 100 || status > 599) {
			throw new TypeError(`Invalid status code: ${status}`)
		}
		const code = HTTP_STATUS_CODE_MAP[status] ?? AuthErrorCode.UNKNOWN
		const preview = body?.trim().split('\n')[0]?.slice(0, 100) ?? ''
		const message = preview ? `HTTP ${status}: ${preview}` : `HTTP ${status}`
		return new AuthError(message, code)
	}

	/**
	 * Converts the error to a plain JSON object for logging or serialization.
	 *
	 * @returns An object containing `name`, `message`, `code`, `context`,
	 *          `timestamp`, and a trimmed stack (first 3 lines).
	 *
	 * @example
	 * console.log(JSON.stringify(error.toJSON()));
	 *
	 * @public
	 * @since 0.1.1
	 */
	toJSON(): Record<string, unknown> {
		return {
			name: this.name,
			message: this.message,
			code: this.code,
			context: this.context,
			timestamp: this.timestamp,
			stack: this.stack?.split('\n').slice(0, 3).join('\n'),
		}
	}

	/**
	 * Returns a formatted, human‑readable error message.
	 *
	 * Format: `[CODE] message | Context: ... | Cause: ...`
	 *
	 * @returns A single string combining code, message, optional context, and cause.
	 *
	 * @example
	 * console.error(error.getFormattedMessage());
	 * // Output: "[NETWORK_ERROR] Network error – check connectivity | Cause: TypeError: fetch failed"
	 *
	 * @public
	 * @since 0.1.1
	 */
	getFormattedMessage(): string {
		const parts = [`[${this.code}] ${this.message}`]
		if (this.context) parts.push(`Context: ${this.context}`)
		if (this.cause) parts.push(`Cause: ${String(this.cause)}`)
		return parts.join(' | ')
	}
}

/**
 * Type guard to check if an unknown value is an AuthError instance.
 *
 * @param error - Value to check.
 * @returns `true` if `error instanceof AuthError`.
 *
 * @example
 * if (isAuthError(err)) {
 *   console.error(err.code);
 * }
 *
 * @public
 * @since 0.1.1
 */
export function isAuthError(error: unknown): error is AuthError {
	return error instanceof AuthError
}
