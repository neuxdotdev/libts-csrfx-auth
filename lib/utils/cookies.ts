/**
 * @fileoverview Cookie parsing and serialization utilities.
 *
 * Provides functions to extract cookies from HTTP response headers,
 * build Cookie header strings from a cookie map, and parse individual
 * Set-Cookie header values.
 *
 * @module utils/cookies
 * @public
 */

/**
 * Extracts all cookies from a Response object's `Set-Cookie` headers.
 *
 * @param headers - The `Headers` object from a `fetch` Response.
 * @returns A `Map` where each key is a cookie name and the value is the cookie value.
 *
 * @remarks
 * The function reads all `Set-Cookie` headers (using `headers.getSetCookie()`),
 * parses each with {@link parseSetCookie}, and stores the name‑value pairs
 * in a `Map`. Only the cookie name and value are captured; attributes like
 * `HttpOnly`, `Secure`, `Path`, `Expires`, etc., are ignored.
 *
 * If `headers.getSetCookie` is not available (e.g., in some non‑standard environments),
 * it falls back to an empty array, resulting in an empty Map.
 *
 * @example
 * const response = await fetch('/login');
 * const cookies = parseCookies(response.headers);
 * console.log(cookies.get('sessionId')); // "abc123..."
 *
 * @see {@link buildCookieHeader}
 * @see {@link parseSetCookie}
 * @since 0.1.1
 * @public
 */
export function parseCookies(headers: Headers): Map<string, string> {
	const cookies = new Map<string, string>()
	const setCookieHeaders = headers.getSetCookie?.() ?? []
	for (const cookieStr of setCookieHeaders) {
		const parsed = parseSetCookie(cookieStr)
		if (parsed !== null) {
			cookies.set(parsed.name, parsed.value)
		}
	}
	return cookies
}

/**
 * Serializes a map of cookies into a valid `Cookie` request header string.
 *
 * @param cookies - A `Map` where keys are cookie names and values are cookie values.
 * @returns A semicolon‑separated string suitable for the `Cookie` header.
 *
 * @remarks
 * The generated string is in the format `name1=value1; name2=value2; ...`.
 * No encoding or escaping is performed – the caller must ensure that names
 * and values are already safe for HTTP headers (i.e., they do not contain
 * characters that would break the header syntax, such as semicolons, commas,
 * or whitespace).
 *
 * @example
 * const cookies = new Map([['sessionId', 'abc123'], ['theme', 'dark']]);
 * const header = buildCookieHeader(cookies);
 * // header === "sessionId=abc123; theme=dark"
 *
 * @see {@link parseCookies}
 * @since 0.1.1
 * @public
 */
export function buildCookieHeader(cookies: Map<string, string>): string {
	const parts: string[] = []
	for (const [name, value] of cookies) {
		parts.push(`${name}=${value}`)
	}
	return parts.join('; ')
}

/**
 * Parses a raw `Set-Cookie` header string into its name and value.
 *
 * @param cookieStr - The raw `Set-Cookie` header string (e.g., `"sessionId=abc123; HttpOnly; Path=/"`).
 * @returns An object with `name` and `value` properties, or `null` if
 *          the string does not contain a valid name‑value pair.
 *
 * @remarks
 * This function extracts the first `name=value` pair before the first
 * semicolon (if any). It does **not** parse additional attributes
 * (e.g., `HttpOnly`, `Secure`, `Path`, `Max-Age`, `Expires`). Those are ignored.
 *
 * The extraction algorithm:
 * 1. Find the first semicolon (`;`) – everything before it is the `name=value` part.
 * 2. Split that part at the first equals sign (`=`) to get name and value.
 * 3. Trim whitespace from name and value.
 * 4. Return `null` if the name is empty after trimming.
 *
 * @example
 * const parsed = parseSetCookie('sessionId=abc123; HttpOnly; Path=/');
 * console.log(parsed); // { name: "sessionId", value: "abc123" }
 *
 * @example
 * parseSetCookie('invalid-cookie'); // null
 *
 * @example
 * parseSetCookie('   name   =   value   ; extra'); // { name: "name", value: "value" }
 *
 * @see {@link parseCookies}
 * @since 0.1.1
 * @public
 */
export function parseSetCookie(cookieStr: string): { name: string; value: string } | null {
	const semicolonIdx = cookieStr.indexOf(';')
	const nameValue = semicolonIdx === -1 ? cookieStr : cookieStr.slice(0, semicolonIdx)
	const eqIdx = nameValue.indexOf('=')
	if (eqIdx === -1) return null
	const name = nameValue.slice(0, eqIdx).trim()
	const value = nameValue.slice(eqIdx + 1).trim()
	if (!name) return null
	return { name, value }
}
