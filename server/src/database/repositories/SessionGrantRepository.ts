import { Injectable } from '@nestjs/common';
import { DataSource, LessThanOrEqual, type EntityManager } from 'typeorm';
import { SessionGrant } from '../entities/SessionGrant';

@Injectable()
export class SessionGrantRepository {
    constructor(private readonly dataSource: DataSource) {}

    async upsert(
        sessionId: number,
        storyId: string,
        expiresAt: Date,
        manager: EntityManager = this.dataSource.manager
    ): Promise<void> {
        await manager.upsert(SessionGrant, { sessionId, storyId, expiresAt }, ['sessionId', 'storyId']);
    }

    findLive(tokenHash: string, now: Date, manager: EntityManager = this.dataSource.manager): Promise<SessionGrant[]> {
        return this.live(tokenHash, now, manager).getMany();
    }

    findLiveForStory(
        tokenHash: string,
        storyId: string,
        now: Date,
        manager: EntityManager = this.dataSource.manager
    ): Promise<SessionGrant | null> {
        return this.live(tokenHash, now, manager).andWhere('grant.storyId = :storyId', { storyId }).getOne();
    }

    existsLive(tokenHash: string, now: Date, manager: EntityManager = this.dataSource.manager): Promise<boolean> {
        return this.live(tokenHash, now, manager).getExists();
    }

    async deleteExpired(now: Date, manager: EntityManager = this.dataSource.manager): Promise<void> {
        await manager.delete(SessionGrant, { expiresAt: LessThanOrEqual(now) });
    }

    private live(tokenHash: string, now: Date, manager: EntityManager) {
        return manager
            .createQueryBuilder(SessionGrant, 'grant')
            .innerJoinAndSelect('grant.session', 'session')
            .where('session.tokenHash = :tokenHash', { tokenHash })
            .andWhere('grant.expiresAt > :now', { now });
    }
}
