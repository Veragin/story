import { randomBytes } from 'node:crypto';

export const GRANT_TTL_MS = 24 * 60 * 60_000;

const DEFAULT_PRUNE_MS = 10 * 60_000;

export type TSessionStoreOptions = {
    ttlMs?: number;
    pruneMs?: number;
};

type TSession = { grants: Map<string, number> };

export class SessionStore {
    private readonly ttlMs: number;
    private readonly sessions = new Map<string, TSession>();
    private readonly pruneTimer: NodeJS.Timeout;

    constructor({ ttlMs = GRANT_TTL_MS, pruneMs = DEFAULT_PRUNE_MS }: TSessionStoreOptions = {}) {
        this.ttlMs = ttlMs;
        this.pruneTimer = setInterval(() => this.prune(), pruneMs);
        this.pruneTimer.unref();
    }

    grant(token: string | undefined, storyId: string): { token: string; expiresAt: number } {
        const existing = token === undefined ? undefined : this.live(token);
        const id = existing && token !== undefined ? token : randomBytes(32).toString('base64url');
        const session = existing ?? { grants: new Map<string, number>() };
        if (!existing) this.sessions.set(id, session);
        const expiresAt = Date.now() + this.ttlMs;
        session.grants.set(storyId, expiresAt);
        return { token: id, expiresAt };
    }

    expiresAt(token: string | undefined, storyId: string): number | null {
        if (token === undefined) return null;
        return this.live(token)?.grants.get(storyId) ?? null;
    }

    storyIds(token: string | undefined): string[] {
        if (token === undefined) return [];
        return [...(this.live(token)?.grants.keys() ?? [])].sort();
    }

    revoke(token: string | undefined): void {
        if (token !== undefined) this.sessions.delete(token);
    }

    prune(now = Date.now()): void {
        for (const [token, session] of this.sessions) this.pruneSession(token, session, now);
    }

    get size(): number {
        this.prune();
        return this.sessions.size;
    }

    close(): void {
        clearInterval(this.pruneTimer);
    }

    private live(token: string): TSession | undefined {
        const session = this.sessions.get(token);
        if (!session) return undefined;
        return this.pruneSession(token, session, Date.now()) ? session : undefined;
    }

    private pruneSession(token: string, session: TSession, now: number): boolean {
        for (const [storyId, expiresAt] of session.grants) {
            if (expiresAt <= now) session.grants.delete(storyId);
        }
        if (session.grants.size > 0) return true;
        this.sessions.delete(token);
        return false;
    }
}
