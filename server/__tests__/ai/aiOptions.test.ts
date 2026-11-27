import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ConfigService } from '@nestjs/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_AGENTS_CONFIG } from '../../aiLauncher/agentsConfig';
import { aiOptionsFromConfig } from '../../src/ai/aiOptions';
import { parseEnv, type TEnv } from '../../src/config/env';

let dir: string;

beforeAll(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'story-ai-options-'));
});

afterAll(() => rm(dir, { recursive: true, force: true }));

const optionsOf = (env: Record<string, string>) => {
    const lines: string[] = [];
    const config = new ConfigService<TEnv, true>(parseEnv(env));
    return { options: aiOptionsFromConfig(config, (line) => lines.push(line)), lines };
};

describe('aiOptionsFromConfig', () => {
    it('takes the model, the budget cap and the gemini section from the agents config', async () => {
        const file = path.join(dir, 'ai_agents.json');
        await writeFile(
            file,
            JSON.stringify({ claude: { defaultModel: 'claude-opus-5-5', maxBudgetUsd: 3 }, gemini: { maxPerStory: 1 } })
        );
        const { options, lines } = optionsOf({ AI_AGENTS_CONFIG_FILE: file });
        expect(options).toMatchObject({
            model: 'claude-opus-5-5',
            maxBudgetUsd: 3,
            gemini: { ...DEFAULT_AGENTS_CONFIG.gemini, maxPerStory: 1 },
        });
        expect(lines).toEqual([]);
    });

    it('uses the defaults without a file', () => {
        const { options } = optionsOf({ AI_AGENTS_CONFIG_FILE: path.join(dir, 'missing.json') });
        expect(options).toMatchObject({
            model: DEFAULT_AGENTS_CONFIG.claude.defaultModel,
            maxBudgetUsd: DEFAULT_AGENTS_CONFIG.claude.maxBudgetUsd,
            gemini: DEFAULT_AGENTS_CONFIG.gemini,
        });
    });

    it('falls back to the deprecated AI_MODEL / AI_MAX_BUDGET_USD and logs them; the file wins', async () => {
        const file = path.join(dir, 'budget-only.json');
        await writeFile(file, JSON.stringify({ claude: { maxBudgetUsd: 4 } }));
        const { options, lines } = optionsOf({
            AI_AGENTS_CONFIG_FILE: file,
            AI_MODEL: 'claude-opus-5-5',
            AI_MAX_BUDGET_USD: '2',
        });
        expect(options).toMatchObject({ model: 'claude-opus-5-5', maxBudgetUsd: 4 });
        expect(lines).toEqual([
            expect.stringMatching(/^AI_MODEL is deprecated/),
            expect.stringMatching(/^AI_MAX_BUDGET_USD is deprecated/),
        ]);
    });

    it('fails on an invalid file', async () => {
        const file = path.join(dir, 'invalid.json');
        await writeFile(file, JSON.stringify({ claude: { defaultModel: 'claude-haiku-5' } }));
        expect(() => optionsOf({ AI_AGENTS_CONFIG_FILE: file })).toThrow(/defaultModel/);
    });
});
