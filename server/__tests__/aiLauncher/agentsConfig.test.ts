import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_AGENTS_CONFIG, readAgentsConfig } from '../../aiLauncher/agentsConfig';

let dir: string;

beforeAll(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'story-ai-agents-'));
});

afterAll(() => rm(dir, { recursive: true, force: true }));

const configFile = async (content: unknown) => {
    const file = path.join(dir, `ai_agents-${Math.random().toString(36).slice(2)}.json`);
    await writeFile(file, typeof content === 'string' ? content : JSON.stringify(content));
    return file;
};

const collectLog = () => {
    const lines: string[] = [];
    return { lines, log: (line: string) => lines.push(line) };
};

describe('readAgentsConfig', () => {
    it('uses the built-in defaults for a missing, empty or directory file', async () => {
        const expected = {
            claude: {
                models: ['claude-sonnet-5-5', 'claude-opus-5-5'],
                defaultModel: 'claude-sonnet-5-5',
                maxBudgetUsd: 5,
            },
            gemini: {
                imageModels: { 'gemini-nano-banana-2.1': { creditsPerImage: 4, maxReferences: 3 } },
                defaultImageModel: 'gemini-nano-banana-2.1',
                timeoutMs: 120_000,
                maxConcurrent: 4,
                maxPerStory: 2,
                imagesPerMinute: 6,
            },
        };
        expect(DEFAULT_AGENTS_CONFIG).toEqual(expected);
        expect(readAgentsConfig(path.join(dir, 'missing.json'))).toEqual(expected);
        expect(readAgentsConfig(await configFile(' \n'))).toEqual(expected);
        expect(readAgentsConfig(await configFile({}))).toEqual(expected);
        const directory = path.join(dir, 'mounted-as-dir');
        await mkdir(directory);
        expect(readAgentsConfig(directory)).toEqual(expected);
    });

    it('matches the checked-in example', () => {
        const example = path.resolve(import.meta.dirname, '../../../docker/secrets/ai_agents.example.json');
        expect(readAgentsConfig(example)).toEqual(DEFAULT_AGENTS_CONFIG);
    });

    it('fills the missing section and keys of a partial file', async () => {
        const config = readAgentsConfig(
            await configFile({ gemini: { imageModels: { 'gemini-x': { creditsPerImage: 2 } }, maxPerStory: 1 } })
        );
        expect(config.claude).toEqual(DEFAULT_AGENTS_CONFIG.claude);
        expect(config.gemini).toEqual({
            ...DEFAULT_AGENTS_CONFIG.gemini,
            imageModels: { 'gemini-x': { creditsPerImage: 2, maxReferences: 3 } },
            defaultImageModel: 'gemini-x',
            maxPerStory: 1,
        });
    });

    it('defaults defaultModel to the first model of the list', async () => {
        const config = readAgentsConfig(await configFile({ claude: { models: ['claude-opus-5-5'] } }));
        expect(config.claude.defaultModel).toBe('claude-opus-5-5');
    });

    it.each([
        ['a defaultModel outside models', { claude: { defaultModel: 'claude-haiku-5' } }, /defaultModel/],
        [
            'a defaultImageModel outside imageModels',
            { gemini: { defaultImageModel: 'gemini-nope' } },
            /defaultImageModel/,
        ],
        ['an empty models list', { claude: { models: [] } }, /models/],
        ['no image model', { gemini: { imageModels: {} } }, /imageModels/],
        ['an unknown key', { claude: { maxBudgetUSD: 3 } }, /maxBudgetUSD/],
        ['a zero budget', { claude: { maxBudgetUsd: 0 } }, /maxBudgetUsd/],
        ['a fractional timeout', { gemini: { timeoutMs: 1.5 } }, /timeoutMs/],
        ['a model id with a space', { claude: { models: ['bad model'] } }, /models/],
        ['a non-object', [], /expected object/],
        ['broken JSON', '{ "claude": ', /JSON/],
    ])('rejects %s', async (_, content, message) => {
        const file = await configFile(content);
        expect(() => readAgentsConfig(file)).toThrow(message);
        expect(() => readAgentsConfig(file)).toThrow(file);
    });

    it('falls back to the deprecated env variables and logs each one that is set', () => {
        const { lines, log } = collectLog();
        const config = readAgentsConfig(
            path.join(dir, 'missing.json'),
            { AI_MODELS: ['claude-opus-5-5'], AI_MAX_BUDGET_USD: 2 },
            log
        );
        expect(config.claude).toEqual({
            models: ['claude-opus-5-5'],
            defaultModel: 'claude-opus-5-5',
            maxBudgetUsd: 2,
        });
        expect(lines).toHaveLength(2);
        expect(lines[0]).toMatch(/AI_MODELS is deprecated: set claude\.models in .*missing\.json/);
        expect(lines[1]).toMatch(/AI_MAX_BUDGET_USD is deprecated: set claude\.maxBudgetUsd/);
    });

    it('logs nothing without deprecated env variables', () => {
        const { lines, log } = collectLog();
        readAgentsConfig(path.join(dir, 'missing.json'), {}, log);
        expect(lines).toEqual([]);
    });

    it('lets the file win over the env variables, key by key', async () => {
        const { lines, log } = collectLog();
        const file = await configFile({ claude: { defaultModel: 'claude-opus-5-5' }, gemini: {} });
        const config = readAgentsConfig(file, { AI_MODEL: 'claude-sonnet-5-5', AI_MAX_BUDGET_USD: 3 }, log);
        expect(config.claude).toEqual({
            models: ['claude-sonnet-5-5', 'claude-opus-5-5'],
            defaultModel: 'claude-opus-5-5',
            maxBudgetUsd: 3,
        });
        expect(lines).toHaveLength(2);
    });

    it('validates the env fallbacks like the file', () => {
        expect(() => readAgentsConfig(path.join(dir, 'missing.json'), { AI_MODEL: 'claude-haiku-5' })).toThrow(
            /defaultModel/
        );
    });
});
