/**
 * @fileoverview CSRF token extraction from HTML.
 *
 * Provides a function to locate a CSRF token inside an HTML document,
 * supporting common patterns: `<input name="_token" value="...">` and
 * `<meta name="csrf-token" content="...">`.
 *
 * @module utils/csrf
 * @public
 */

/**
 * Extracts a CSRF token from an HTML string.
 *
 * @param html - The full HTML document as a string. Must be a complete or partial HTML response.
 * @returns The extracted token string, or `null` if no token is found in any of the supported patterns.
 *
 * @remarks
 * The function searches for the token in the following order:
 * 1. `<input name="_token" value="TOKEN">` (order of attributes may vary)
 * 2. `<meta name="csrf-token" content="TOKEN">` (order may vary)
 *
 * Regular expressions are case‑insensitive and handle single or double quotes.
 *
 * **Edge cases:**
 * - If the HTML contains multiple matching tokens, the first one encountered is returned.
 * - The token value is trimmed of leading/trailing whitespace.
 * - Malformed HTML or missing quotes may cause extraction to fail; consider using a proper HTML parser for production if the patterns are unreliable.
 *
 * **Performance:** The function uses regular expressions that scan the entire HTML string.
 * For very large HTML documents (e.g., >1 MB), consider extracting the token from a smaller fragment.
 *
 * @example
 * // Input tag pattern
 * const html = `<form><input type="hidden" name="_token" value="abc123"></form>`;
 * const token = extractCsrfToken(html);
 * console.log(token); // "abc123"
 *
 * @example
 * // Meta tag pattern
 * const metaHtml = `<meta name="csrf-token" content="xyz789">`;
 * extractCsrfToken(metaHtml); // "xyz789"
 *
 * @example
 * // Attribute order variation
 * const altHtml = `<input value="def456" name="_token">`;
 * extractCsrfToken(altHtml); // "def456"
 *
 * @see {@link AuthClient} - Uses this function during login flow.
 * @since 0.1.1
 * @public
 */
export function extractCsrfToken(html: string): string | null {
	const inputRe = /<input[^>]+name\s*=\s*["_']_token["'][^>]+value\s*=\s*["']([^"']+)["'][^>]*>/i
	const inputAltRe =
		/<input[^>]+value\s*=\s*["']([^"']+)["'][^>]+name\s*=\s*["_']_token["'][^>]*>/i
	const inputMatch = html.match(inputRe) ?? html.match(inputAltRe)
	if (inputMatch?.[1]?.trim()) {
		return inputMatch[1].trim()
	}

	const metaRe =
		/<meta[^>]+name\s*=\s*["']csrf-token["'][^>]+content\s*=\s*["']([^"']+)["'][^>]*>/i
	const metaMatch = html.match(metaRe)
	if (metaMatch?.[1]?.trim()) {
		return metaMatch[1].trim()
	}

	const metaAltRe =
		/<meta[^>]+content\s*=\s*["']([^"']+)["'][^>]+name\s*=\s*["']csrf-token["'][^>]*>/i
	const metaAltMatch = html.match(metaAltRe)
	if (metaAltMatch?.[1]?.trim()) {
		return metaAltMatch[1].trim()
	}

	return null
}
