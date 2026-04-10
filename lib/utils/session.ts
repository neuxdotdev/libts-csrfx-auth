import { join } from 'node:path'
import { mkdir, readFile, writeFile, unlink, access } from 'node:fs/promises'
import { homedir } from 'node:os'
export interface Cookie {
	readonly name: string
	readonly value: string
	readonly domain: string
	readonly path: string
	readonly httpOnly: boolean
	readonly secure: boolean
}
export interface SessionData {
	readonly cookies: readonly Cookie[]
	readonly csrfToken: string
	readonly loggedIn: boolean
	readonly timestamp: number
}
export function sessionWithCsrfToken(session: SessionData, newToken: string): SessionData {
	return {
		...session,
		csrfToken: newToken,
		timestamp: Date.now(),
	}
}
export function isSessionFresh(session: SessionData, maxAgeMs: number): boolean {
	return Date.now() - session.timestamp < maxAgeMs
}
export class CacheManager {
	private readonly cacheDir: string
	private readonly cacheFile: string
	constructor(customDir?: string) {
		this.cacheDir = customDir ?? join(homedir(), '.cache', 'libts-csrfx-auth')
		this.cacheFile = join(this.cacheDir, 'session.json')
	}
	async save(session: SessionData): Promise<void> {
		await mkdir(this.cacheDir, { recursive: true })
		await writeFile(this.cacheFile, JSON.stringify(session, null, 2), 'utf8')
	}
	async load(): Promise<SessionData | null> {
		try {
			await access(this.cacheFile)
			const content = await readFile(this.cacheFile, 'utf8')
			const parsed: unknown = JSON.parse(content)
			return parsed as SessionData
		} catch {
			return null
		}
	}
	async clear(): Promise<void> {
		try {
			await access(this.cacheFile)
			await unlink(this.cacheFile)
		} catch {}
	}
	async updateCsrfToken(newToken: string): Promise<void> {
		const existing = await this.load()
		if (existing !== null) {
			await this.save(sessionWithCsrfToken(existing, newToken))
		}
	}
	async loadFresh(maxAgeMs: number): Promise<SessionData | null> {
		const session = await this.load()
		if (session === null) return null
		return isSessionFresh(session, maxAgeMs) ? session : null
	}
	get cacheFilePath(): string {
		return this.cacheFile
	}
	get cacheDirPath(): string {
		return this.cacheDir
	}
}
