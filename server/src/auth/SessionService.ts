import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { DataSource, LessThanOrEqual, type EntityManager } from 'typeorm';
import { AUTH_OPTIONS, type TAuthOptions } from './authOptions';
import { Session } from './Session';
import { SessionGrant } from './SessionGrant';

export const SESSION_PRUNE_JOB = 'session-prune';

const SESSION_PRUNE_MS = 10 * 60_000;

type TSessionRef = { id: number; token: string };

export type TGrantResult = { token: string; expiresAt: number };

const newToken = () => randomBytes(32).toString('base64url');

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

@Injectable()
export class SessionService {
    constructor(
        private readonly dataSource: DataSource,
        @Inject(AUTH_OPTIONS) private readonly options: Pick<TAuthOptions, 'grantTtlMs'>
    ) {}

    grant(token: string | undefined, storyId: string): Promise<TGrantResult> {
        return this.dataSource.transaction(async (manager) => {
            const now = Date.now();
            const live = token === undefined ? null : await this.liveSession(token, now, manager);
            const session = live ?? (await this.createSession(manager));
            const expiresAt = now + this.options.grantTtlMs;
            await manager.upsert(SessionGrant, { sessionId: session.id, storyId, expiresAt: new Date(expiresAt) }, [
                'sessionId',
                'storyId',
            ]);
            return { token: session.token, expiresAt };
        });
    }

    async expiresAt(token: string | undefined, storyId: string): Promise<number | null> {
        if (token === undefined) return null;
        const grant = await this.liveGrants(token, Date.now()).andWhere('grant.storyId = :storyId', { storyId }).getOne();
        return grant?.expiresAt.getTime() ?? null;
    }

    async storyIds(token: string | undefined): Promise<string[]> {
        if (token === undefined) return [];
        const grants = await this.liveGrants(token, Date.now()).getMany();
        return grants.map((grant) => grant.storyId).sort();
    }

    async revoke(token: string | undefined): Promise<void> {
        if (token !== undefined) await this.dataSource.manager.delete(Session, { tokenHash: hashToken(token) });
    }

    async prune(now = Date.now()): Promise<void> {
        await this.dataSource.manager.delete(SessionGrant, { expiresAt: LessThanOrEqual(new Date(now)) });
        await this.dataSource.query(
            'DELETE `session` FROM `session` LEFT JOIN `session_grant` ON `session_grant`.`sessionId` = `session`.`id` ' +
                'WHERE `session_grant`.`sessionId` IS NULL'
        );
    }

    @Interval(SESSION_PRUNE_JOB, SESSION_PRUNE_MS)
    async pruneOnInterval(): Promise<void> {
        await this.prune();
    }

    private liveGrants(token: string, now: number, manager: EntityManager = this.dataSource.manager) {
        return manager
            .createQueryBuilder(SessionGrant, 'grant')
            .innerJoinAndSelect('grant.session', 'session')
            .where('session.tokenHash = :tokenHash', { tokenHash: hashToken(token) })
            .andWhere('grant.expiresAt > :now', { now: new Date(now) });
    }

    // a session without a live grant is dead: its token must not be revived by a new login
    private async liveSession(token: string, now: number, manager: EntityManager): Promise<TSessionRef | null> {
        const session = await manager.findOneBy(Session, { tokenHash: hashToken(token) });
        if (!session) return null;
        if (await this.liveGrants(token, now, manager).getExists()) return { id: session.id, token };
        await manager.delete(Session, { id: session.id });
        return null;
    }

    private async createSession(manager: EntityManager): Promise<TSessionRef> {
        const token = newToken();
        const result = await manager.insert(Session, { tokenHash: hashToken(token) });
        const id: unknown = result.identifiers[0]?.id;
        if (typeof id !== 'number') throw new Error('Session insert returned no id');
        return { id, token };
    }
}
