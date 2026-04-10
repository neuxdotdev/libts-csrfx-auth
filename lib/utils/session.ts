/**
 * @fileoverview Persistent session storage on the file system.
 *
 * Manages caching of session data (cookies, CSRF token, login state) to disk,
 * allowing reuse of authenticated sessions across process restarts.
 *
 * @module utils/session
 * @public
 */

import { join } from 'node:path'
import { mkdir, readFile, writeFile, unlink, access } from 'node:fs/promises'
import { homedir } from 'node:os'

/**
 * Represents a single HTTP cookie with common attributes.
 *
 * @remarks
 * Used to store cookies persistently in the session cache. This interface
 * captures the essential fields required to reconstruct a cookie for subsequent
 * requests. Attributes like `httpOnly` and `secure` are stored for completeness
 * but are not actively enforced by the cache manager.
 *
 * @public
 * @since 0.1.1
 */
export interface Cookie {
	/** Cookie name (e.g., `"sessionId"`). */
	readonly name: string

	/** Cookie value (e.g., `"abc123def456"`). */
	readonly value: string

	/** Domain that the cookie belongs to (e.g., `"example.com"`). */
	readonly domain: string

	/** URL path scope (e.g., `"/"` or `"/api"`). */
	readonly path: string

	/**
	 * Whether the cookie is `HttpOnly` (inaccessible to client‑side JavaScript).
	 *
	 * @remarks
	 * This flag is informational; the cache does not enforce it.
	 */
	readonly httpOnly: boolean

	/**
	 * Whether the cookie is only sent over HTTPS.
	 *
	 * @remarks
	 * This flag is informational; the cache does not enforce it.
	 */
	readonly secure: boolean
}

/**
 * Complete session data stored in the cache.
 *
 * @remarks
 * This object is serialized to JSON and saved to disk. All fields are read‑only
 * to encourage immutability. Use {@link sessionWithCsrfToken} to create updated copies.
 *
 * @public
 * @since 0.1.1
 */
export interface SessionData {
	/** List of cookies associated with the session. */
	readonly cookies: readonly Cookie[]

	/** Current CSRF token (may be updated over time, e.g., after token refresh). */
	readonly csrfToken: string

	/** Whether the session is considered logged in (typically `true` after successful login). */
	readonly loggedIn: boolean

	/**
	 * Unix timestamp (milliseconds) when this session was created or last updated.
	 *
	 * @remarks
	 * Used by {@link isSessionFresh} and {@link CacheManager.loadFresh} to determine
	 * session freshness.
	 */
	readonly timestamp: number
}

/**
 * Creates a new `SessionData` object with an updated CSRF token.
 *
 * @param session - The original session data.
 * @param newToken - The new CSRF token to set.
 * @returns A new `SessionData` object with the updated token and the current timestamp.
 *
 * @remarks
 * The timestamp is reset to `Date.now()` to reflect the update time.
 * All other fields (cookies, loggedIn flag) are copied from the original session.
 * The original session object is not mutated.
 *
 * @example
 * const oldSession = await cacheManager.load();
 * const updated = sessionWithCsrfToken(oldSession, 'new_csrf_token_123');
 * await cacheManager.save(updated);
 *
 * @see {@link CacheManager.updateCsrfToken}
 * @since 0.1.1
 * @public
 */
export function sessionWithCsrfToken(session: SessionData, newToken: string): SessionData {
	return {
		...session,
		csrfToken: newToken,
		timestamp: Date.now(),
	}
}

/**
 * Checks if a cached session is still fresh based on its age.
 *
 * @param session - The session to check.
 * @param maxAgeMs - Maximum allowed age in milliseconds.
 * @returns `true` if the session's timestamp is within the last `maxAgeMs` milliseconds,
 *          otherwise `false`.
 *
 * @remarks
 * A session is considered fresh if `Date.now() - session.timestamp < maxAgeMs`.
 * This is a simple age‑based heuristic; it does not validate the session against
 * the server.
 *
 * @example
 * if (isSessionFresh(session, 3600000)) {
 *   console.log('Session is less than 1 hour old');
 * }
 *
 * @see {@link CacheManager.loadFresh}
 * @since 0.1.1
 * @public
 */
export function isSessionFresh(session: SessionData, maxAgeMs: number): boolean {
	return Date.now() - session.timestamp < maxAgeMs
}

/**
 * Manages reading, writing, and deleting session cache on disk.
 *
 * @remarks
 * The cache is stored as JSON in `~/.cache/libts-csrfx-auth/session.json`
 * (or a custom directory if provided). All operations are asynchronous and
 * use Node.js `fs/promises` APIs.
 *
 * **Thread safety:** This class is not designed for concurrent access from
 * multiple processes. If you need to share sessions across processes, consider
 * using a database or distributed cache.
 *
 * @example
 * const cache = new CacheManager();
 * await cache.save(sessionData);
 * const loaded = await cache.load();
 *
 * @public
 * @since 0.1.1
 */
export class CacheManager {
	private readonly cacheDir: string
	private readonly cacheFile: string

	/**
	 * Creates a new cache manager.
	 *
	 * @param customDir - Optional custom cache directory.
	 *                    If not provided, defaults to `~/.cache/libts-csrfx-auth`.
	 *
	 * @remarks
	 * The directory is created automatically when {@link save} is called.
	 * The cache file name is always `session.json`.
	 *
	 * @example
	 * // Default location (user home directory)
	 * const cache = new CacheManager();
	 *
	 * @example
	 * // Custom directory
	 * const cache = new CacheManager('./my-app-cache');
	 */
	constructor(customDir?: string) {
		this.cacheDir = customDir ?? join(homedir(), '.cache', 'libts-csrfx-auth')
		this.cacheFile = join(this.cacheDir, 'session.json')
	}

	/**
	 * Saves session data to disk.
	 *
	 * @param session - The session data to save.
	 * @returns A promise that resolves when the write operation completes.
	 *
	 * @remarks
	 * Creates the cache directory if it does not exist (using `recursive: true`).
	 * Overwrites any existing file at the same path.
	 * The session is serialized to JSON with 2‑space indentation for readability.
	 *
	 * @example
	 * await cache.save({
	 *   cookies: [...],
	 *   csrfToken: 'abc123',
	 *   loggedIn: true,
	 *   timestamp: Date.now()
	 * });
	 *
	 * @see {@link load}
	 * @see {@link clear}
	 */
	async save(session: SessionData): Promise<void> {
		await mkdir(this.cacheDir, { recursive: true })
		await writeFile(this.cacheFile, JSON.stringify(session, null, 2), 'utf8')
	}

	/**
	 * Loads session data from disk.
	 *
	 * @returns The stored session, or `null` if the file does not exist, is corrupted,
	 *          or cannot be read for any reason.
	 *
	 * @remarks
	 * If the file exists but contains invalid JSON, the function catches the error
	 * and returns `null`. No error is thrown to the caller.
	 *
	 * @example
	 * const session = await cache.load();
	 * if (session) {
	 *   console.log(`Session from ${new Date(session.timestamp)}`);
	 * }
	 *
	 * @see {@link save}
	 * @see {@link loadFresh}
	 */
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

	/**
	 * Deletes the cached session file if it exists.
	 *
	 * @returns A promise that resolves when the deletion is complete (or if the file did not exist).
	 *
	 * @remarks
	 * Does nothing if the file is not present. No error is thrown.
	 *
	 * @example
	 * await cache.clear(); // removes session.json
	 */
	async clear(): Promise<void> {
		try {
			await access(this.cacheFile)
			await unlink(this.cacheFile)
		} catch {
			// File does not exist – ignore
		}
	}

	/**
	 * Updates the CSRF token in the cached session.
	 *
	 * @param newToken - The new CSRF token to store.
	 * @returns A promise that resolves when the update is complete.
	 *
	 * @remarks
	 * If no session is cached, this method does nothing (no error is thrown).
	 * The timestamp of the session is updated to the current time.
	 * Internally uses {@link sessionWithCsrfToken} and {@link save}.
	 *
	 * @example
	 * await cache.updateCsrfToken('new_token_456');
	 *
	 * @see {@link sessionWithCsrfToken}
	 */
	async updateCsrfToken(newToken: string): Promise<void> {
		const existing = await this.load()
		if (existing !== null) {
			await this.save(sessionWithCsrfToken(existing, newToken))
		}
	}

	/**
	 * Loads the cached session only if it is fresh (age < `maxAgeMs`).
	 *
	 * @param maxAgeMs - Maximum allowed age in milliseconds.
	 * @returns The session if it exists and is fresh, otherwise `null`.
	 *
	 * @remarks
	 * This is a convenience method that combines {@link load} and {@link isSessionFresh}.
	 * If the session exists but is older than `maxAgeMs`, it returns `null`.
	 *
	 * @example
	 * // Only use session if it's less than 1 hour old
	 * const session = await cache.loadFresh(3600000);
	 * if (session) {
	 *   // session is valid
	 * }
	 *
	 * @see {@link load}
	 * @see {@link isSessionFresh}
	 */
	async loadFresh(maxAgeMs: number): Promise<SessionData | null> {
		const session = await this.load()
		if (session === null) return null
		return isSessionFresh(session, maxAgeMs) ? session : null
	}

	/**
	 * Returns the full filesystem path to the session cache file.
	 *
	 * @example
	 * console.log(cache.cacheFilePath); // "/home/user/.cache/libts-csrfx-auth/session.json"
	 */
	get cacheFilePath(): string {
		return this.cacheFile
	}

	/**
	 * Returns the directory containing the session cache.
	 *
	 * @example
	 * console.log(cache.cacheDirPath); // "/home/user/.cache/libts-csrfx-auth"
	 */
	get cacheDirPath(): string {
		return this.cacheDir
	}
}
