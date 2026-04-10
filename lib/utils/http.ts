import { AuthError, AuthErrorCode } from '../handler/error.js'
export interface FetchOptions extends Omit<RequestInit, 'signal'> {
	readonly timeoutMs?: number
	readonly maxRetries?: number
	readonly retryDelayMs?: number
	readonly retryOn?: (response: Response) => boolean
}
const DEFAULT_TIMEOUT_MS = 15_000
const DEFAULT_MAX_RETRIES = 3
const DEFAULT_RETRY_DELAY_MS = 100
const DEFAULT_RETRY_PREDICATE = (res: Response): boolean => !res.ok && res.status >= 500
export async function fetchWithRetry(
	url: string | URL,
	options: FetchOptions = {},
	shouldRetry: (res: Response) => boolean = DEFAULT_RETRY_PREDICATE,
): Promise<Response> {
	const {
		timeoutMs = DEFAULT_TIMEOUT_MS,
		maxRetries = DEFAULT_MAX_RETRIES,
		retryDelayMs = DEFAULT_RETRY_DELAY_MS,
		retryOn = shouldRetry,
		...fetchInit
	} = options
	let lastError: unknown
	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		const controller = new AbortController()
		const timer = setTimeout(() => controller.abort(), timeoutMs)
		try {
			const response = await globalThis.fetch(url, {
				...fetchInit,
				signal: controller.signal,
			})
			clearTimeout(timer)
			if (response.ok || !retryOn(response)) {
				return response
			}
			lastError = new Error(`HTTP ${response.status}: ${response.statusText}`)
		} catch (err) {
			clearTimeout(timer)
			lastError = err
		}
		if (attempt < maxRetries) {
			const delay = retryDelayMs * 2 ** attempt
			await new Promise<void>((resolve) => setTimeout(resolve, delay))
		}
	}
	throw AuthError.fromUnknown(lastError, AuthErrorCode.NETWORK_ERROR)
}
