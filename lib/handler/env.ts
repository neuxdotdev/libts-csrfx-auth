import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
export interface EnvVars {
	BASE_URL: string
	LOGIN_PATH?: string
	LOGOUT_PATH?: string
	USER_EMAIL?: string
	USER_PASSWORD?: string
}
const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..', '..')
function parseEnvFile(content: string): Record<string, string> {
	const parsed: Record<string, string> = {}
	for (const rawLine of content.split('\n')) {
		const trimmed = rawLine.trim()
		if (!trimmed || trimmed.startsWith('#')) continue
		const eqIdx = trimmed.indexOf('=')
		if (eqIdx === -1) continue
		const key = trimmed.slice(0, eqIdx).trim()
		if (!key) continue
		let value = trimmed.slice(eqIdx + 1).trim()
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1)
		}
		parsed[key] = value
	}
	return parsed
}
function isValidUrl(url: string): boolean {
	try {
		const parsed = new URL(url)
		return parsed.protocol === 'http:' || parsed.protocol === 'https:'
	} catch {
		return false
	}
}
function isValidEmail(email: string): boolean {
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
	return emailRegex.test(email)
}
export function loadEnv(): EnvVars {
	const envPath = join(rootDir, '.env')
	let fileVars: Record<string, string> = {}
	if (existsSync(envPath)) {
		const content = readFileSync(envPath, 'utf8')
		fileVars = parseEnvFile(content)
	}
	const bunEnv: Record<string, string | undefined> = Bun.env
	const baseUrl = fileVars['BASE_URL'] ?? bunEnv['BASE_URL'] ?? ''
	if (!baseUrl) {
		throw new Error(
			'EnvVars: BASE_URL is required but not set in .env or environment variables',
		)
	}
	if (!isValidUrl(baseUrl)) {
		throw new Error(`EnvVars: BASE_URL must be a valid HTTP/HTTPS URL (got: ${baseUrl})`)
	}
	let loginPath = fileVars['LOGIN_PATH'] ?? bunEnv['LOGIN_PATH']
	if (loginPath !== undefined) {
		const trimmed = loginPath.trim()
		if (trimmed === '') {
			throw new Error('EnvVars: LOGIN_PATH cannot be empty string if provided')
		}
		if (/[?#]/.test(trimmed)) {
			throw new Error(`EnvVars: LOGIN_PATH must not contain ? or # (got: ${trimmed})`)
		}
		loginPath = trimmed
	}
	let logoutPath = fileVars['LOGOUT_PATH'] ?? bunEnv['LOGOUT_PATH']
	if (logoutPath !== undefined) {
		const trimmed = logoutPath.trim()
		if (trimmed === '') {
			throw new Error('EnvVars: LOGOUT_PATH cannot be empty string if provided')
		}
		if (/[?#]/.test(trimmed)) {
			throw new Error(`EnvVars: LOGOUT_PATH must not contain ? or # (got: ${trimmed})`)
		}
		logoutPath = trimmed
	}
	let userEmail = fileVars['USER_EMAIL'] ?? bunEnv['USER_EMAIL']
	if (userEmail !== undefined) {
		const trimmed = userEmail.trim()
		if (trimmed !== '') {
			if (!isValidEmail(trimmed)) {
				throw new Error(
					`EnvVars: USER_EMAIL must be a valid email address (got: ${trimmed})`,
				)
			}
			userEmail = trimmed
		} else {
			userEmail = undefined
		}
	}
	let userPassword = fileVars['USER_PASSWORD'] ?? bunEnv['USER_PASSWORD']
	if (userPassword !== undefined) {
		const trimmed = userPassword.trim()
		if (trimmed === '') {
			throw new Error('EnvVars: USER_PASSWORD cannot be empty string if provided')
		}
		userPassword = trimmed
	}
	const result: EnvVars = {
		BASE_URL: baseUrl,
	}
	if (loginPath !== undefined) result.LOGIN_PATH = loginPath
	if (logoutPath !== undefined) result.LOGOUT_PATH = logoutPath
	if (userEmail !== undefined) result.USER_EMAIL = userEmail
	if (userPassword !== undefined) result.USER_PASSWORD = userPassword
	return result
}
