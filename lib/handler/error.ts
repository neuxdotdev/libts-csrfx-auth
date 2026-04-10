export const AuthErrorCode = {
	INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
	CSRF_NOT_FOUND: 'CSRF_NOT_FOUND',
	CSRF_FETCH_FAILED: 'CSRF_FETCH_FAILED',
	CSRF_EXPIRED: 'CSRF_EXPIRED',
	LOGIN_FAILED: 'LOGIN_FAILED',
	LOGOUT_FAILED: 'LOGOUT_FAILED',
	NOT_AUTHENTICATED: 'NOT_AUTHENTICATED',
	NETWORK_ERROR: 'NETWORK_ERROR',
	TIMEOUT: 'TIMEOUT',
	CACHE_ERROR: 'CACHE_ERROR',
	VALIDATION_ERROR: 'VALIDATION_ERROR',
	TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
	SERVER_ERROR: 'SERVER_ERROR',
	UNAUTHORIZED: 'UNAUTHORIZED',
	FORBIDDEN: 'FORBIDDEN',
	NOT_FOUND: 'NOT_FOUND',
	UNKNOWN: 'UNKNOWN',
} as const
export type AuthErrorCode = (typeof AuthErrorCode)[keyof typeof AuthErrorCode]
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
export function isRetryableError(error: AuthError): boolean {
	const retryableCodes: AuthErrorCode[] = [
		AuthErrorCode.NETWORK_ERROR,
		AuthErrorCode.TIMEOUT,
		AuthErrorCode.SERVER_ERROR,
		AuthErrorCode.TOO_MANY_REQUESTS,
	]
	return retryableCodes.includes(error.code)
}
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
export class AuthError extends Error {
	readonly code: AuthErrorCode
	readonly context?: string | undefined
	readonly timestamp: number
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
	static fromStatus(status: number, body?: string): AuthError {
		if (typeof status !== 'number' || status < 100 || status > 599) {
			throw new TypeError(`Invalid status code: ${status}`)
		}
		const code = HTTP_STATUS_CODE_MAP[status] ?? AuthErrorCode.UNKNOWN
		const preview = body?.trim().split('\n')[0]?.slice(0, 100) ?? ''
		const message = preview ? `HTTP ${status}: ${preview}` : `HTTP ${status}`
		return new AuthError(message, code)
	}
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
	getFormattedMessage(): string {
		const parts = [`[${this.code}] ${this.message}`]
		if (this.context) parts.push(`Context: ${this.context}`)
		if (this.cause) parts.push(`Cause: ${String(this.cause)}`)
		return parts.join(' | ')
	}
}
export function isAuthError(error: unknown): error is AuthError {
	return error instanceof AuthError
}
