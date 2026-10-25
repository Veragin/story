import { describe, expect, it } from 'vitest';
import { StoryRepository } from '../src/database/repositories/StoryRepository';
import { StoryVersionConflictError } from '../src/stories/StoryVersionConflictError';
import { setupTestDatabase } from './helpers/database';
import { storyFixture } from './helpers/storiesRoot';

const dataSource = setupTestDatabase();
const stories = () => new StoryRepository(dataSource);

describe('StoryRepository', () => {
    it('inserts and reads a story back with version "1"', async () => {
        const file = storyFixture();
        expect(await stories().insert('alpha', file)).toBe('1');
        expect(await stories().exists('alpha')).toBe(true);
        expect(await stories().read('alpha')).toEqual(file);
        expect(await stories().readVersioned('alpha')).toEqual({ file, version: '1' });
    });

    it('answers missing and malformed ids with nothing', async () => {
        expect(await stories().exists('missing')).toBe(false);
        expect(await stories().read('missing')).toBeNull();
        expect(await stories().exists('../etc')).toBe(false);
        expect(await stories().readVersioned('Not An Id')).toBeNull();
        await expect(stories().insert('Not An Id', storyFixture())).rejects.toThrow('Not a story id');
    });

    it('refuses a second row with the same id', async () => {
        await stories().insert('alpha', storyFixture());
        await expect(stories().insert('alpha', storyFixture())).rejects.toThrow();
    });

    it('writes with the current version and bumps it', async () => {
        await stories().insert('alpha', storyFixture());
        const next = storyFixture({ name: 'Renamed', public: true, description: 'new' });
        expect(await stories().write('alpha', next, '1')).toBe('2');
        expect(await stories().readVersioned('alpha')).toEqual({ file: next, version: '2' });
        expect(await stories().write('alpha', storyFixture(), '2')).toBe('3');
    });

    it('rejects a stale, malformed or missing version without writing', async () => {
        await stories().insert('alpha', storyFixture());
        await stories().write('alpha', storyFixture({ name: 'Second' }), '1');
        for (const version of ['1', '3', 'abc', '', '2.0']) {
            await expect(stories().write('alpha', storyFixture({ name: 'Lost' }), version)).rejects.toBeInstanceOf(
                StoryVersionConflictError
            );
        }
        await expect(stories().write('missing', storyFixture(), '1')).rejects.toBeInstanceOf(StoryVersionConflictError);
        expect(await stories().readVersioned('alpha')).toEqual({
            file: storyFixture({ name: 'Second' }),
            version: '2',
        });
    });

    it('lets exactly one of two concurrent writers with the same version win', async () => {
        await stories().insert('alpha', storyFixture());
        const results = await Promise.allSettled([
            stories().exclusive((manager) => stories().write('alpha', storyFixture({ name: 'A' }), '1', manager)),
            stories().exclusive((manager) => stories().write('alpha', storyFixture({ name: 'B' }), '1', manager)),
        ]);
        const won = results.filter((result) => result.status === 'fulfilled');
        const lost = results.filter((result) => result.status === 'rejected');
        expect(won).toHaveLength(1);
        expect(lost).toHaveLength(1);
        expect(lost[0]?.status === 'rejected' && lost[0].reason).toBeInstanceOf(StoryVersionConflictError);
        const current = await stories().readVersioned('alpha');
        expect(current?.version).toBe('2');
        expect(['A', 'B']).toContain(current?.file.name);
    });

    it('rolls back an exclusive block that throws', async () => {
        await stories().insert('alpha', storyFixture());
        await expect(
            stories().exclusive(async (manager) => {
                await stories().write('alpha', storyFixture({ name: 'Rolled back' }), '1', manager);
                throw new Error('boom');
            })
        ).rejects.toThrow('boom');
        expect(await stories().readVersioned('alpha')).toEqual({ file: storyFixture(), version: '1' });
    });

    it('lists stories by name, then id', async () => {
        await stories().insert('zeta', storyFixture({ name: 'beta' }));
        await stories().insert('alpha', storyFixture({ name: 'Gamma' }));
        await stories().insert('beta-2', storyFixture({ name: 'beta' }));
        await stories().insert('beta', storyFixture({ name: 'beta' }));
        await stories().insert('aa', storyFixture({ name: 'Ångström' }));
        const list = await stories().list();
        expect(list.map(({ id }) => id)).toEqual(['aa', 'beta', 'beta-2', 'zeta', 'alpha']);
        expect(list[0]?.file).toEqual(storyFixture({ name: 'Ångström' }));
        expect(await stories().count()).toBe(5);
    });

    it('upserts: inserts, leaves an equal row alone, updates a changed one', async () => {
        expect(await stories().upsert('alpha', storyFixture())).toBe('inserted');
        expect(await stories().upsert('alpha', storyFixture())).toBe('unchanged');
        expect((await stories().readVersioned('alpha'))?.version).toBe('1');
        expect(await stories().upsert('alpha', storyFixture({ author: 'Other' }))).toBe('updated');
        expect(await stories().readVersioned('alpha')).toEqual({
            file: storyFixture({ author: 'Other' }),
            version: '2',
        });
    });

    it('stores an email as is and none as NULL, read back as an empty string', async () => {
        await stories().insert('alpha', storyFixture({ email: 'Me@Example.com' }));
        await stories().insert('beta', storyFixture());
        expect(await dataSource.query('SELECT id, email FROM story ORDER BY id')).toEqual([
            { id: 'alpha', email: 'Me@Example.com' },
            { id: 'beta', email: null },
        ]);
        expect((await stories().read('alpha'))?.email).toBe('Me@Example.com');
        expect((await stories().read('beta'))?.email).toBe('');
        expect(await stories().write('alpha', storyFixture({ email: '' }), '1')).toBe('2');
        expect(await dataSource.query('SELECT email FROM story WHERE id = ?', ['alpha'])).toEqual([{ email: null }]);
        expect(await stories().upsert('beta', storyFixture())).toBe('unchanged');
    });

    it('sets the password and bumps the version', async () => {
        await stories().insert('alpha', storyFixture());
        await stories().setPassword('alpha', 'scrypt$new');
        expect(await stories().readVersioned('alpha')).toEqual({
            file: storyFixture({ password: 'scrypt$new' }),
            version: '2',
        });
    });
});
