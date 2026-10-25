import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import type { EntityManager } from 'typeorm';
import { DatabaseService } from '../database/DatabaseService';
import { SessionGrantRepository } from '../database/repositories/SessionGrantRepository';
import { SessionRepository } from '../database/repositories/SessionRepository';
import { StoryPasswordResetRepository } from '../database/repositories/StoryPasswordResetRepository';
import { AUTH_OPTIONS, type TAuthOptions } from './authOptions';

export const SESSION_PRUNE_JOB = 'session-prune';

const SESSION_PRUNE_MS = 10 * 60_000;

type TSessionRef = { id: number; token: string };

export type TGrantResult = { token: string; expiresAt: number };

export const newToken = () => randomBytes(32).toString('base64url');

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

@Injectable()
export class SessionService {
    constructor(
        private readonly database: DatabaseService,
        private readonly sessions: SessionRepository,
        private readonly grants: SessionGrantRepository,
        private readonly resets: StoryPasswordResetRepository,
        @Inject(AUTH_OPTIONS) private readonly options: Pick<TAuthOptions, 'grantTtlMs'>
    ) {}

    grant(token: string | undefined, storyId: string, { exclusive = false } = {}): Promise<TGrantResult> {
        return this.database.transaction(async (manager) => {
            const now = Date.now();
            const live = token === undefined ? null : await this.liveSession(token, now, manager);
            const session = live ?? (await this.createSession(manager));
            const expiresAt = now + this.options.grantTtlMs;
            if (exclusive) await this.grants.deleteOtherStories(session.id, storyId, manager);
            await this.grants.upsert(session.id, storyId, new Date(expiresAt), manager);
            return { token: session.token, expiresAt };
        });
    }

    async expiresAt(token: string | undefined, storyId: string): Promise<number | null> {
        if (token === undefined) return null;
        const grant = await this.grants.findLiveForStory(hashToken(token), storyId, new Date());
        return grant?.expiresAt.getTime() ?? null;
    }

    async storyIds(token: string | undefined): Promise<string[]> {
        if (token === undefined) return [];
        const grants = await this.grants.findLive(hashToken(token), new Date());
        return grants.map((grant) => grant.storyId).sort();
    }

    async revoke(token: string | undefined): Promise<void> {
        if (token !== undefined) await this.sessions.deleteByTokenHash(hashToken(token));
    }

    async prune(now = Date.now()): Promise<void> {
        await this.grants.deleteExpired(new Date(now));
        await this.sessions.deleteWithoutGrants();
        await this.resets.deleteExpired(new Date(now));
    }

    @Interval(SESSION_PRUNE_JOB, SESSION_PRUNE_MS)
    async pruneOnInterval(): Promise<void> {
        await this.prune();
    }

    // a session without a live grant is dead: its token must not be revived by a new login
    private async liveSession(token: string, now: number, manager: EntityManager): Promise<TSessionRef | null> {
        const tokenHash = hashToken(token);
        const session = await this.sessions.findByTokenHash(tokenHash, manager);
        if (!session) return null;
        if (await this.grants.existsLive(tokenHash, new Date(now), manager)) return { id: session.id, token };
        await this.sessions.delete(session.id, manager);
        return null;
    }

    private async createSession(manager: EntityManager): Promise<TSessionRef> {
        const token = newToken();
        return { id: await this.sessions.insert(hashToken(token), manager), token };
    }
}
