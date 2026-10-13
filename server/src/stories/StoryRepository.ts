import { isDeepStrictEqual } from 'node:util';
import { Injectable } from '@nestjs/common';
import { isStoryId, type TVersion } from '@story/protocol';
import { DataSource, type EntityManager } from 'typeorm';
import { Story } from './Story';
import type { TStoryFile } from './storyFile';
import { StoryVersionConflictError } from './StoryVersionConflictError';

export type TVersionedStoryFile = { file: TStoryFile; version: TVersion };

export type TStoryListEntry = { id: string; file: TStoryFile };

export type TUpsertResult = 'inserted' | 'updated' | 'unchanged';

const FIRST_VERSION = 1;

const VERSION_PATTERN = /^\d+$/;

const toFile = (row: Story): TStoryFile => ({
    name: row.name,
    author: row.author,
    password: row.passwordHash,
    mapSize: { width: row.mapWidth, height: row.mapHeight },
    description: row.description,
    public: row.isPublic,
});

const toColumns = (file: TStoryFile) => ({
    name: file.name,
    author: file.author,
    passwordHash: file.password,
    mapWidth: file.mapSize.width,
    mapHeight: file.mapSize.height,
    description: file.description,
    isPublic: file.public,
});

const toVersion = (version: number): TVersion => String(version);

const parseVersion = (version: TVersion): number | null => (VERSION_PATTERN.test(version) ? Number(version) : null);

const sameFile = (a: TStoryFile, b: TStoryFile): boolean => isDeepStrictEqual(toColumns(a), toColumns(b));

const assertStoryId = (storyId: string) => {
    if (!isStoryId(storyId)) throw new Error(`Not a story id: ${JSON.stringify(storyId)}`);
};

@Injectable()
export class StoryRepository {
    constructor(private readonly dataSource: DataSource) {}

    exists(storyId: string, manager: EntityManager = this.dataSource.manager): Promise<boolean> {
        if (!isStoryId(storyId)) return Promise.resolve(false);
        return manager.existsBy(Story, { id: storyId });
    }

    async read(storyId: string, manager: EntityManager = this.dataSource.manager): Promise<TStoryFile | null> {
        return (await this.readVersioned(storyId, manager))?.file ?? null;
    }

    async readVersioned(
        storyId: string,
        manager: EntityManager = this.dataSource.manager
    ): Promise<TVersionedStoryFile | null> {
        if (!isStoryId(storyId)) return null;
        const row = await manager.findOneBy(Story, { id: storyId });
        return row ? { file: toFile(row), version: toVersion(row.version) } : null;
    }

    async list(manager: EntityManager = this.dataSource.manager): Promise<TStoryListEntry[]> {
        const rows = await manager.find(Story);
        return rows
            .map((row) => ({ id: row.id, file: toFile(row) }))
            .sort((a, b) => a.file.name.localeCompare(b.file.name) || a.id.localeCompare(b.id));
    }

    count(manager: EntityManager = this.dataSource.manager): Promise<number> {
        return manager.count(Story);
    }

    async insert(
        storyId: string,
        file: TStoryFile,
        manager: EntityManager = this.dataSource.manager
    ): Promise<TVersion> {
        assertStoryId(storyId);
        await manager.insert(Story, { id: storyId, ...toColumns(file), version: FIRST_VERSION });
        return toVersion(FIRST_VERSION);
    }

    async write(
        storyId: string,
        file: TStoryFile,
        expected: TVersion,
        manager: EntityManager = this.dataSource.manager
    ): Promise<TVersion> {
        const current = parseVersion(expected);
        if (current === null) throw new StoryVersionConflictError(storyId);
        const result = await manager
            .createQueryBuilder()
            .update(Story)
            .set({ ...toColumns(file), version: () => '`version` + 1' })
            .where('id = :id AND version = :version', { id: storyId, version: current })
            .execute();
        if (result.affected !== 1) throw new StoryVersionConflictError(storyId);
        return toVersion(current + 1);
    }

    upsert(storyId: string, file: TStoryFile): Promise<TUpsertResult> {
        return this.exclusive(async (manager) => {
            const row = await manager.findOne(Story, { where: { id: storyId }, lock: { mode: 'pessimistic_write' } });
            if (!row) {
                await this.insert(storyId, file, manager);
                return 'inserted';
            }
            if (sameFile(toFile(row), file)) return 'unchanged';
            await this.write(storyId, file, toVersion(row.version), manager);
            return 'updated';
        });
    }

    exclusive<T>(fn: (manager: EntityManager) => Promise<T>): Promise<T> {
        return this.dataSource.transaction(fn);
    }
}
