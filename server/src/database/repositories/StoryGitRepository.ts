import { Injectable } from '@nestjs/common';
import type { TVersion } from '@story/protocol';
import { DataSource, type EntityManager } from 'typeorm';
import { StoryGit } from '../entities/StoryGit';

export type TStoryGitRecord = {
    remoteUrl: string;
    branch: string;
    tokenEncrypted: string | null;
    authorName: string;
    authorEmail: string;
};

export type TVersionedStoryGit = { record: TStoryGitRecord; version: TVersion };

const FIRST_VERSION = 1;

const VERSION_PATTERN = /^\d+$/;

const toRecord = (row: StoryGit): TStoryGitRecord => ({
    remoteUrl: row.remoteUrl,
    branch: row.branch,
    tokenEncrypted: row.tokenEncrypted,
    authorName: row.authorName,
    authorEmail: row.authorEmail,
});

const parseVersion = (version: TVersion): number | null => (VERSION_PATTERN.test(version) ? Number(version) : null);

@Injectable()
export class StoryGitRepository {
    constructor(private readonly dataSource: DataSource) {}

    async read(storyId: string, manager: EntityManager = this.dataSource.manager): Promise<TVersionedStoryGit | null> {
        const row = await manager.findOneBy(StoryGit, { storyId });
        return row ? { record: toRecord(row), version: String(row.version) } : null;
    }

    async insert(
        storyId: string,
        record: TStoryGitRecord,
        manager: EntityManager = this.dataSource.manager
    ): Promise<TVersion> {
        await manager.insert(StoryGit, { storyId, ...record, version: FIRST_VERSION });
        return String(FIRST_VERSION);
    }

    // null: `expected` is not the row's version (or the row is gone)
    async write(
        storyId: string,
        record: TStoryGitRecord,
        expected: TVersion,
        manager: EntityManager = this.dataSource.manager
    ): Promise<TVersion | null> {
        const current = parseVersion(expected);
        if (current === null) return null;
        const result = await manager
            .createQueryBuilder()
            .update(StoryGit)
            .set({ ...record, version: () => '`version` + 1' })
            .where('storyId = :storyId AND version = :version', { storyId, version: current })
            .execute();
        return result.affected === 1 ? String(current + 1) : null;
    }

    async delete(storyId: string, expected: TVersion, manager: EntityManager = this.dataSource.manager) {
        const current = parseVersion(expected);
        if (current === null) return false;
        const result = await manager.delete(StoryGit, { storyId, version: current });
        return result.affected === 1;
    }

    exclusive<T>(fn: (manager: EntityManager) => Promise<T>): Promise<T> {
        return this.dataSource.transaction(fn);
    }
}
