import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager, type FindOptionsOrder } from 'typeorm';
import { StoryAiSession } from '../entities/StoryAiSession';

export type TAiSessionRecord = {
    sessionId: string;
    storyId: string;
    title: string;
    pid: number | null;
    containerName: string | null;
    createdAt: Date;
    lastUsedAt: Date;
};

export const AI_SESSION_HISTORY = 10;

const NOW_SQL = () => 'CURRENT_TIMESTAMP(6)';

const toRecord = (row: StoryAiSession): TAiSessionRecord => ({
    sessionId: row.sessionId,
    storyId: row.storyId,
    title: row.title,
    pid: row.pid,
    containerName: row.containerName,
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt,
});

const NEWEST_FIRST: FindOptionsOrder<StoryAiSession> = { lastUsedAt: 'DESC', createdAt: 'DESC', sessionId: 'ASC' };

@Injectable()
export class AiSessionRepository {
    constructor(private readonly dataSource: DataSource) {}

    // an existing session keeps its title (the first prompt) and only gets touched
    async upsert(
        storyId: string,
        sessionId: string,
        title: string,
        manager: EntityManager = this.dataSource.manager
    ): Promise<void> {
        await manager.query(
            'INSERT INTO `story_ai_session` (`sessionId`, `storyId`, `title`) VALUES (?, ?, ?) ' +
                'ON DUPLICATE KEY UPDATE `lastUsedAt` = CURRENT_TIMESTAMP(6)',
            [sessionId, storyId, title]
        );
    }

    async touch(sessionId: string, manager: EntityManager = this.dataSource.manager): Promise<void> {
        await manager.update(StoryAiSession, { sessionId }, { lastUsedAt: NOW_SQL });
    }

    async read(
        storyId: string,
        sessionId: string,
        manager: EntityManager = this.dataSource.manager
    ): Promise<TAiSessionRecord | null> {
        const row = await manager.findOneBy(StoryAiSession, { storyId, sessionId });
        return row ? toRecord(row) : null;
    }

    async listRecent(
        storyId: string,
        limit = AI_SESSION_HISTORY,
        manager: EntityManager = this.dataSource.manager
    ): Promise<TAiSessionRecord[]> {
        const rows = await manager.find(StoryAiSession, { where: { storyId }, order: NEWEST_FIRST, take: limit });
        return rows.map(toRecord);
    }

    async setRunning(
        sessionId: string,
        pid: number,
        containerName: string,
        manager: EntityManager = this.dataSource.manager
    ): Promise<void> {
        await manager.update(StoryAiSession, { sessionId }, { pid, containerName });
    }

    async clearRunning(sessionId: string, manager: EntityManager = this.dataSource.manager): Promise<void> {
        await manager.update(StoryAiSession, { sessionId }, { pid: null, containerName: null });
    }

    async clearAllRunning(manager: EntityManager = this.dataSource.manager): Promise<void> {
        await manager
            .createQueryBuilder()
            .update(StoryAiSession)
            .set({ pid: null, containerName: null })
            .where('pid IS NOT NULL OR containerName IS NOT NULL')
            .execute();
    }

    // returns the removed session ids, so their transcripts can be deleted
    prune(storyId: string, keep = AI_SESSION_HISTORY): Promise<string[]> {
        return this.dataSource.transaction(async (manager) => {
            const rows = await manager.find(StoryAiSession, {
                select: { sessionId: true },
                where: { storyId },
                order: NEWEST_FIRST,
                lock: { mode: 'pessimistic_write' },
            });
            const ids = rows.slice(keep).map((row) => row.sessionId);
            if (ids.length > 0) await manager.delete(StoryAiSession, ids);
            return ids;
        });
    }
}
