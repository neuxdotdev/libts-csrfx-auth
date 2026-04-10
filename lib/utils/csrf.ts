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
