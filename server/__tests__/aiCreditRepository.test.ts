import { describe, expect, it } from 'vitest';
import { AiCreditRepository, type TAiUsageRecord } from '../src/database/repositories/AiCreditRepository';
import { StoryRepository } from '../src/database/repositories/StoryRepository';
import { setupTestDatabase } from './helpers/database';
import { storyFixture } from './helpers/storiesRoot';

const dataSource = setupTestDatabase();
const credits = () => new AiCreditRepository(dataSource);

const SESSION_ID = '0b6f3a52-6d1e-4f7c-9a43-2d8e5c1f7a90';

const usage = (overrides: Partial<TAiUsageRecord> = {}): TAiUsageRecord => ({
    sessionId: SESSION_ID,
    model: 'claude-sonnet-5-5',
    inputTokens: 1200,
    outputTokens: 340,
    cacheReadTokens: 5000,
    cacheCreationTokens: 800,
    costMicroUsd: 41_250,
    credits: 5,
    ...overrides,
});

const usageRows = () =>
    dataSource.query(
        'SELECT storyId, kind, sessionId, model, inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens, ' +
            'CAST(costMicroUsd AS CHAR) AS costMicroUsd, credits FROM story_ai_usage ORDER BY id'
    );

const withStory = async (storyId = 'alpha') => {
    await new StoryRepository(dataSource).insert(storyId, storyFixture());
};

describe('AiCreditRepository', () => {
    it('answers 0 for a story without a credit row', async () => {
        await withStory();
        expect(await credits().balance('alpha')).toBe(0);
        expect(await credits().balance('missing')).toBe(0);
    });

    it('tops up, creating the row on first use', async () => {
        await withStory();
        expect(await credits().topUp('alpha', 100)).toBe(100);
        expect(await credits().topUp('alpha', 50)).toBe(150);
        expect(await credits().balance('alpha')).toBe(150);
    });

    it('refuses a top-up that is not a positive whole number', async () => {
        await withStory();
        for (const amount of [0, -5, 1.5, Number.NaN]) {
            await expect(credits().topUp('alpha', amount)).rejects.toThrow('Not a credit amount');
        }
        expect(await credits().balance('alpha')).toBe(0);
    });

    it('charges a turn: one usage row, the balance lowered, overdraw allowed', async () => {
        await withStory();
        await credits().topUp('alpha', 8);
        expect(await credits().charge('alpha', usage())).toBe(3);
        expect(await credits().charge('alpha', usage({ credits: 7, costMicroUsd: 61_000 }))).toBe(-4);
        expect(await credits().balance('alpha')).toBe(-4);
        expect(await usageRows()).toEqual([
            { storyId: 'alpha', kind: 'turn', ...usage(), costMicroUsd: '41250' },
            { storyId: 'alpha', kind: 'turn', ...usage({ credits: 7 }), costMicroUsd: '61000' },
        ]);
    });

    it('charges an image: a usage row of kind image without a session, the balance lowered', async () => {
        await withStory();
        await credits().topUp('alpha', 10);
        await credits().charge('alpha', usage({ credits: 2 }));
        const image = {
            model: 'gemini-test-image',
            inputTokens: 300,
            outputTokens: 1290,
            costMicroUsd: 40_000,
            credits: 4,
        };
        expect(await credits().chargeImage('alpha', image)).toBe(4);
        expect(await credits().chargeImage('alpha', image)).toBe(0);
        const rows = await usageRows();
        expect(rows.map((row: { kind: string }) => row.kind)).toEqual(['turn', 'image', 'image']);
        expect(rows[1]).toEqual({
            storyId: 'alpha',
            kind: 'image',
            sessionId: null,
            model: 'gemini-test-image',
            inputTokens: 300,
            outputTokens: 1290,
            cacheReadTokens: 0,
            cacheCreationTokens: 0,
            costMicroUsd: '40000',
            credits: 4,
        });
        await expect(credits().chargeImage('alpha', { ...image, credits: 1.5 })).rejects.toThrow('Not a credit amount');
    });

    it('the AddAiImageUsage migration: kind defaults to turn, sessionId is nullable', async () => {
        const columns = await dataSource.query(
            'SELECT COLUMN_NAME AS name, IS_NULLABLE AS nullable, COLUMN_DEFAULT AS dflt, COLUMN_TYPE AS type ' +
                "FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'story_ai_usage' " +
                "AND COLUMN_NAME IN ('kind', 'sessionId') ORDER BY COLUMN_NAME"
        );
        expect(columns).toEqual([
            { name: 'kind', nullable: 'NO', dflt: 'turn', type: "enum('turn','image')" },
            { name: 'sessionId', nullable: 'YES', dflt: null, type: 'varchar(64)' },
        ]);
    });

    it('charges a story that never had credits', async () => {
        await withStory();
        expect(await credits().charge('alpha', usage({ credits: 2 }))).toBe(-2);
    });

    it('rolls back the usage row when the charge fails', async () => {
        await expect(credits().charge('missing', usage())).rejects.toThrow();
        expect(await usageRows()).toEqual([]);
        await withStory();
        await expect(credits().charge('alpha', usage({ credits: -1 }))).rejects.toThrow('Not a credit amount');
        expect(await usageRows()).toEqual([]);
    });

    it('keeps stories apart and cascades on story delete', async () => {
        await withStory('alpha');
        await withStory('beta');
        await credits().topUp('alpha', 10);
        await credits().topUp('beta', 20);
        await credits().charge('beta', usage());
        expect(await credits().balance('alpha')).toBe(10);
        expect(await credits().balance('beta')).toBe(15);
        await dataSource.query('DELETE FROM story WHERE id = ?', ['beta']);
        expect(await credits().balance('beta')).toBe(0);
        expect(await usageRows()).toEqual([]);
    });
});
