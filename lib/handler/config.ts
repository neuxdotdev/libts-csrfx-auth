import { loadEnv } from './env.js'
export type { EnvVars } from './env.js'
export { loadEnv } from './env.js'
export interface EnvConfigOptions {
	baseUrl: string
	loginPath?: string
	logoutPath?: string
	email?: string
	password?: string
}
export class EnvConfig {
	readonly baseUrl: string
	readonly loginPath: string
	readonly logoutPath: string
	readonly email: string
	readonly password: string
	constructor(options: EnvConfigOptions) {
		if (!options.baseUrl || typeof options.baseUrl !== 'string') {
			throw new Error('EnvConfig: baseUrl is required and must be a string')
		}
		let cleanBaseUrl = options.baseUrl.trim()
		if (cleanBaseUrl === '') {
			throw new Error('EnvConfig: baseUrl cannot be empty')
		}
		const urlPattern = /^https?:\/\/[^\s/$.?#].[^\s]*$/i
		if (!urlPattern.test(cleanBaseUrl)) {
			throw new Error(
				`EnvConfig: baseUrl must be a valid HTTP/HTTPS URL (got: ${cleanBaseUrl})`,
			)
		}
		this.baseUrl = cleanBaseUrl.replace(/\/+$/, '')
		const rawLoginPath = options.loginPath?.trim()
		if (rawLoginPath !== undefined) {
			if (rawLoginPath === '') {
				throw new Error('EnvConfig: loginPath cannot be empty string')
			}
			if (/[?#]/.test(rawLoginPath)) {
				throw new Error(
					`EnvConfig: loginPath must not contain ? or # (got: ${rawLoginPath})`,
				)
			}
		}
		this.loginPath = rawLoginPath?.replace(/^\/+/, '') ?? 'login'
		const rawLogoutPath = options.logoutPath?.trim()
		if (rawLogoutPath !== undefined) {
			if (rawLogoutPath === '') {
				throw new Error('EnvConfig: logoutPath cannot be empty string')
			}
			if (/[?#]/.test(rawLogoutPath)) {
				throw new Error(
					`EnvConfig: logoutPath must not contain ? or # (got: ${rawLogoutPath})`,
				)
			}
		}
		this.logoutPath = rawLogoutPath?.replace(/^\/+/, '') ?? 'logout'
		const rawEmail = options.email?.trim()
		if (rawEmail !== undefined && rawEmail !== '') {
			const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
			if (!emailPattern.test(rawEmail)) {
				throw new Error(`EnvConfig: email must be a valid email address (got: ${rawEmail})`)
			}
			this.email = rawEmail
		} else {
			this.email = rawEmail ?? ''
		}
		const rawPassword = options.password?.trim()
		if (rawPassword !== undefined && rawPassword === '') {
			throw new Error('EnvConfig: password cannot be empty string if provided')
		}
		this.password = rawPassword ?? ''
	}
	get fullLoginUrl(): string {
		return `${this.baseUrl}/${this.loginPath}`
	}
	get fullLogoutUrl(): string {
		return `${this.baseUrl}/${this.logoutPath}`
	}
	static fromEnv(overrides?: Partial<EnvConfigOptions>): EnvConfig {
		const env = loadEnv()
		if (!env.BASE_URL || typeof env.BASE_URL !== 'string') {
			throw new Error('EnvConfig.fromEnv: BASE_URL environment variable is required')
		}
		const opts: EnvConfigOptions = {
			baseUrl: overrides?.baseUrl ?? env.BASE_URL,
		}
		if (overrides?.loginPath !== undefined) {
			opts.loginPath = overrides.loginPath
		} else if (env.LOGIN_PATH !== undefined) {
			opts.loginPath = env.LOGIN_PATH
		}
		if (overrides?.logoutPath !== undefined) {
			opts.logoutPath = overrides.logoutPath
		} else if (env.LOGOUT_PATH !== undefined) {
			opts.logoutPath = env.LOGOUT_PATH
		}
		if (overrides?.email !== undefined) {
			opts.email = overrides.email
		} else if (env.USER_EMAIL !== undefined) {
			opts.email = env.USER_EMAIL
		}
		if (overrides?.password !== undefined) {
			opts.password = overrides.password
		} else if (env.USER_PASSWORD !== undefined) {
			opts.password = env.USER_PASSWORD
		}
		return new EnvConfig(opts)
	}
	hasValidCredentials(): boolean {
		return this.email !== '' && this.password !== '' && this.email.includes('@')
	}
}
