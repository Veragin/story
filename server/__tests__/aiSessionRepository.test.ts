import { describe, expect, it } from 'vitest';
import { AiSessionRepository } from '../src/database/repositories/AiSessionRepository';
import { StoryRepository } from '../src/database/repositories/StoryRepository';
import { setupTestDatabase } from './helpers/database';
import { storyFixture } from './helpers/storiesRoot';

const dataSource = setupTestDatabase();
const sessions = () => new AiSessionRepository(dataSource);

const sessionId = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const withStory = async (storyId = 'alpha') => {
    await new StoryRepository(dataSource).insert(storyId, storyFixture());
};

// sessions created within one test run share a microsecond clock: pin lastUsedAt for a stable order
const setLastUsed = (id: string, at: string) =>
    dataSource.query('UPDATE story_ai_session SET lastUsedAt = ? WHERE sessionId = ?', [at, id]);

const addSessions = async (storyId: string, count: number) => {
    for (let n = 1; n <= count; n++) {
        await sessions().upsert(storyId, sessionId(n), `Prompt ${n}`);
        await setLastUsed(sessionId(n), `2026-01-01 00:00:${String(n).padStart(2, '0')}.000000`);
    }
};

describe('AiSessionRepository', () => {
    it('upserts a session; a second upsert keeps the title and touches it', async () => {
        await withStory();
        await sessions().upsert('alpha', sessionId(1), 'First prompt');
        const created = await sessions().read('alpha', sessionId(1));
        expect(created).toMatchObject({
            sessionId: sessionId(1),
            storyId: 'alpha',
            title: 'First prompt',
            pid: null,
            containerName: null,
        });
        await setLastUsed(sessionId(1), '2026-01-01 00:00:00.000000');
        await sessions().upsert('alpha', sessionId(1), 'Another prompt');
        const again = await sessions().read('alpha', sessionId(1));
        expect(again?.title).toBe('First prompt');
        expect(again?.createdAt).toEqual(created?.createdAt);
        expect(again?.lastUsedAt.getTime()).toBeGreaterThan(Date.parse('2026-01-01T00:00:00Z'));
    });

    it('reads a session only for its own story', async () => {
        await withStory('alpha');
        await withStory('beta');
        await sessions().upsert('alpha', sessionId(1), 'Mine');
        expect(await sessions().read('beta', sessionId(1))).toBeNull();
        expect(await sessions().read('alpha', sessionId(2))).toBeNull();
    });

    it('touches lastUsedAt', async () => {
        await withStory();
        await sessions().upsert('alpha', sessionId(1), 'Prompt');
        await setLastUsed(sessionId(1), '2026-01-01 00:00:00.000000');
        await sessions().touch(sessionId(1));
        const touched = await sessions().read('alpha', sessionId(1));
        expect(touched?.lastUsedAt.getTime()).toBeGreaterThan(Date.parse('2026-01-01T00:00:00Z'));
    });

    it('lists the most recently used first, at most `limit`, per story', async () => {
        await withStory('alpha');
        await withStory('beta');
        await addSessions('alpha', 12);
        await sessions().upsert('beta', sessionId(99), 'Other story');
        const recent = await sessions().listRecent('alpha');
        expect(recent.map((s) => s.title)).toEqual([12, 11, 10, 9, 8, 7, 6, 5, 4, 3].map((n) => `Prompt ${n}`));
        expect((await sessions().listRecent('alpha', 2)).map((s) => s.sessionId)).toEqual([
            sessionId(12),
            sessionId(11),
        ]);
        expect(await sessions().listRecent('gamma')).toEqual([]);
    });

    it('sets and clears the running pid and container', async () => {
        await withStory();
        await addSessions('alpha', 2);
        await sessions().setRunning(sessionId(1), 4242, 'story-ai-alpha-x1');
        await sessions().setRunning(sessionId(2), 4343, 'story-ai-alpha-x2');
        expect(await sessions().read('alpha', sessionId(1))).toMatchObject({
            pid: 4242,
            containerName: 'story-ai-alpha-x1',
        });
        await sessions().clearRunning(sessionId(1));
        expect(await sessions().read('alpha', sessionId(1))).toMatchObject({ pid: null, containerName: null });
        expect(await sessions().read('alpha', sessionId(2))).toMatchObject({ pid: 4343 });
        await sessions().clearAllRunning();
        expect(await sessions().read('alpha', sessionId(2))).toMatchObject({ pid: null, containerName: null });
    });

    it('prunes all but the `keep` most recent and returns the removed ids', async () => {
        await withStory('alpha');
        await withStory('beta');
        await addSessions('alpha', 13);
        await sessions().upsert('beta', sessionId(99), 'Other story');
        expect(new Set(await sessions().prune('alpha'))).toEqual(new Set([sessionId(1), sessionId(2), sessionId(3)]));
        expect(await sessions().listRecent('alpha', 100)).toHaveLength(10);
        expect(await sessions().prune('alpha')).toEqual([]);
        expect(await sessions().prune('alpha', 8)).toEqual([sessionId(5), sessionId(4)]);
        expect(await sessions().listRecent('beta')).toHaveLength(1);
    });

    it('cascades on story delete', async () => {
        await withStory();
        await addSessions('alpha', 2);
        await dataSource.query('DELETE FROM story WHERE id = ?', ['alpha']);
        expect(await sessions().listRecent('alpha')).toEqual([]);
    });
});
