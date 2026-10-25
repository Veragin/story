import { Injectable } from '@nestjs/common';
import { DataSource, LessThanOrEqual, MoreThan, type EntityManager } from 'typeorm';
import { StoryPasswordReset } from '../entities/StoryPasswordReset';

@Injectable()
export class StoryPasswordResetRepository {
    constructor(private readonly dataSource: DataSource) {}

    async replace(
        storyId: string,
        tokenHash: string,
        expiresAt: Date,
        manager: EntityManager = this.dataSource.manager
    ): Promise<void> {
        await manager.upsert(StoryPasswordReset, { storyId, tokenHash, expiresAt }, ['storyId']);
    }

    findLive(
        storyId: string,
        tokenHash: string,
        now: Date,
        manager: EntityManager = this.dataSource.manager
    ): Promise<StoryPasswordReset | null> {
        return manager.findOneBy(StoryPasswordReset, { storyId, tokenHash, expiresAt: MoreThan(now) });
    }

    async delete(storyId: string, manager: EntityManager = this.dataSource.manager): Promise<void> {
        await manager.delete(StoryPasswordReset, { storyId });
    }

    async deleteExpired(now: Date, manager: EntityManager = this.dataSource.manager): Promise<void> {
        await manager.delete(StoryPasswordReset, { expiresAt: LessThanOrEqual(now) });
    }
}
