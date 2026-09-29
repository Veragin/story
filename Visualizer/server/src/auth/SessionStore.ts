import { randomBytes } from 'node:crypto';

/** How long a login unlocks a story: 24 h from the login. */
export const GRANT_TTL_MS = 24 * 60 * 60_000;

const DEFAULT_PRUNE_MS = 10 * 60_000;

export type TSessionStoreOptions = {
    /** How long a grant lasts (default 24 h). */
    ttlMs?: number;
    /** How often expired grants are swept (default 10 min). Expired grants are also ignored on access. */
    pruneMs?: number;
};

/** One session: `storyId → expiresAt` (ms since the epoch). */
type TSession = { grants: Map<string, number> };

/**
 * The sessions (multiple stories, phase 4): `token → { grants: storyId → expiresAt }`, in memory
 * (plan D2), so a server restart logs everyone out. The token is 32 random bytes in base64url and
 * is what the `story_session` cookie holds; it means nothing without this store.
 *
 * Each successful login adds a grant for one story, valid `ttlMs` from that login, to the
 * browser's session (creating the session on the first login), so one cookie can unlock several
 * stories. A session with no live grant left is dropped.
 */
export class SessionStore {
    private readonly ttlMs: number;
    private readonly sessions = new Map<string, TSession>();
    private readonly pruneTimer: NodeJS.Timeout;

    constructor({ ttlMs = GRANT_TTL_MS, pruneMs = DEFAULT_PRUNE_MS }: TSessionStoreOptions = {}) {
        this.ttlMs = ttlMs;
        this.pruneTimer = setInterval(() => this.prune(), pruneMs);
        this.pruneTimer.unref();
    }

    /**
     * Grant `storyId` to the session of `token`, or to a new session when `token` is missing or
     * unknown (a stale cookie from before a restart). Returns the session's token and the grant's
     * expiry.
     */
    grant(token: string | undefined, storyId: string): { token: string; expiresAt: number } {
        const existing = token === undefined ? undefined : this.live(token);
        const id = existing && token !== undefined ? token : randomBytes(32).toString('base64url');
        const session = existing ?? { grants: new Map<string, number>() };
        if (!existing) this.sessions.set(id, session);
        const expiresAt = Date.now() + this.ttlMs;
        session.grants.set(storyId, expiresAt);
        return { token: id, expiresAt };
    }

    /** When the session's grant for `storyId` expires, or `null` when it has none (or it expired). */
    expiresAt(token: string | undefined, storyId: string): number | null {
        if (token === undefined) return null;
        return this.live(token)?.grants.get(storyId) ?? null;
    }

    /** The stories the session has unlocked, sorted. */
    storyIds(token: string | undefined): string[] {
        if (token === undefined) return [];
        return [...(this.live(token)?.grants.keys() ?? [])].sort();
    }

    /** Drop a session and every grant it holds (logout). */
    revoke(token: string | undefined): void {
        if (token !== undefined) this.sessions.delete(token);
    }

    /** Drop every expired grant, and every session left without one. */
    prune(now = Date.now()): void {
        for (const [token, session] of this.sessions) this.pruneSession(token, session, now);
    }

    /** Number of live sessions (tests). */
    get size(): number {
        this.prune();
        return this.sessions.size;
    }

    /** Stop the prune timer. */
    close(): void {
        clearInterval(this.pruneTimer);
    }

    /** The session of `token` with its expired grants pruned, or `undefined` when there is none left. */
    private live(token: string): TSession | undefined {
        const session = this.sessions.get(token);
        if (!session) return undefined;
        return this.pruneSession(token, session, Date.now()) ? session : undefined;
    }

    /** Prune one session; returns whether it is still alive. */
    private pruneSession(token: string, session: TSession, now: number): boolean {
        for (const [storyId, expiresAt] of session.grants) {
            if (expiresAt <= now) session.grants.delete(storyId);
        }
        if (session.grants.size > 0) return true;
        this.sessions.delete(token);
        return false;
    }
}
