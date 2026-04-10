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
export function buildCookieHeader(cookies: Map<string, string>): string {
	const parts: string[] = []
	for (const [name, value] of cookies) {
		parts.push(`${name}=${value}`)
	}
	return parts.join('; ')
}
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
