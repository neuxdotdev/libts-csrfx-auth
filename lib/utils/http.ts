/**
 * @fileoverview HTTP client with retry and timeout support.
 *
 * Provides a `fetch` wrapper that automatically retries failed requests
 * (configurable predicate, exponential backoff) and enforces a timeout.
 *
 * @module utils/http
 * @public
 */

import { AuthError, AuthErrorCode } from '../handler/error.js'

/**
 * Extended fetch options with retry and timeout settings.
 *
 * @remarks
 * All properties are optional. The `timeoutMs`, `maxRetries`, `retryDelayMs`,
 * and `retryOn` are used by {@link fetchWithRetry}. Any other standard
 * `RequestInit` properties (e.g., `method`, `headers`, `body`) are passed
 * directly to `fetch`.
 *
 * Note: The `signal` property is omitted because it is used internally by
 * the timeout mechanism. Do not provide your own `signal` when using
 * {@link fetchWithRetry}.
 *
 * @public
 * @since 0.1.1
 */
export interface FetchOptions extends Omit<RequestInit, 'signal'> {
	/**
	 * Request timeout in milliseconds.
	 *
	 * @defaultValue 15000
	 * @remarks
	 * If the request takes longer than this duration, it will be aborted
	 * and retried (if retries remain). A timeout is considered a retryable error.
	 */
	readonly timeoutMs?: number

	/**
	 * Maximum number of retry attempts (excluding the initial attempt).
	 *
	 * @defaultValue 3
	 * @remarks
	 * Total attempts = `maxRetries + 1`. The request will be retried up to
	 * this many times after the initial failure.
	 */
	readonly maxRetries?: number

	/**
	 * Initial delay in milliseconds before the first retry.
	 *
	 * @defaultValue 100
	 * @remarks
	 * Delay increases exponentially with each retry: `retryDelayMs * 2^attempt`.
	 * For example, with default values: 100ms, 200ms, 400ms.
	 */
	readonly retryDelayMs?: number

	/**
	 * Predicate to decide if a failed response should be retried.
	 *
	 * @defaultValue Retries only on HTTP status >= 500 (server errors)
	 * @remarks
	 * The predicate receives the `Response` object and should return `true`
	 * if the request should be retried, `false` otherwise.
	 *
	 * @example
	 * // Retry on any non‑2xx status
	 * retryOn: (res) => !res.ok
	 */
	readonly retryOn?: (response: Response) => boolean
}

/** @internal */
const DEFAULT_TIMEOUT_MS = 15_000
/** @internal */
const DEFAULT_MAX_RETRIES = 3
/** @internal */
const DEFAULT_RETRY_DELAY_MS = 100
/** @internal */
const DEFAULT_RETRY_PREDICATE = (res: Response): boolean => !res.ok && res.status >= 500

/**
 * Performs an HTTP request with automatic retries and timeout.
 *
 * @param url - The request URL (string or URL object).
 * @param options - Configuration options extending standard `RequestInit` with retry settings.
 * @param shouldRetry - Optional predicate that overrides the `retryOn` value from `options`.
 *                      If provided, this function is used instead of `options.retryOn`.
 * @returns A `Response` object from the first successful request (i.e., a response that either
 *          satisfies `response.ok === true` or for which the retry predicate returns `false`).
 *
 * @throws {AuthError} With code `NETWORK_ERROR` when all attempts fail, or when the last error
 *                     cannot be classified otherwise. The original error is preserved as the cause.
 *
 * @remarks
 * **Retry conditions:**
 * - The request fails with a network error, timeout, or any exception.
 * - The response is not `ok` (i.e., `response.ok === false`) **and** the retry predicate returns `true`.
 *
 * **Retry mechanism:**
 * - Retries use exponential backoff: `retryDelayMs * 2^attempt`.
 * - The timeout is enforced per attempt using an `AbortController`.
 * - If a response is received but the retry predicate returns `false`, the response is returned immediately (no further retries).
 *
 * **Default behavior:**
 * - Timeout: 15 seconds
 * - Max retries: 3
 * - Retry delay: 100ms (exponential)
 * - Retry predicate: only server errors (HTTP 5xx)
 *
 * **Important:** The `signal` option is not allowed because it is used internally.
 * If you need custom abort logic, wrap this function with your own `AbortController`.
 *
 * @example
 * // Basic usage with default retry (5xx only)
 * const res = await fetchWithRetry('https://api.example.com/data');
 *
 * @example
 * // Custom retry for any non‑200 response, with more retries
 * const res = await fetchWithRetry('/api/login', {
 *   method: 'POST',
 *   body: JSON.stringify({ user: 'admin' }),
 *   headers: { 'Content-Type': 'application/json' },
 *   retryOn: (res) => !res.ok,
 *   maxRetries: 5,
 *   timeoutMs: 10000
 * });
 *
 * @example
 * // Override retry predicate via third parameter
 * const res = await fetchWithRetry(
 *   'https://api.example.com/data',
 *   { maxRetries: 2 },
 *   (res) => res.status === 429 // retry only on rate limiting
 * );
 *
 * @see {@link AuthError} - Error type thrown on failure.
 * @see {@link AuthErrorCode.NETWORK_ERROR} - Error code for network/timeout failures.
 * @since 0.1.1
 * @public
 */
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
