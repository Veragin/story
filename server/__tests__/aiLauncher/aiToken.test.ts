import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { classifyAiToken, readAiToken, tokenEnv } from '../../aiLauncher/aiToken';

let dir: string;

beforeAll(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'story-ai-token-'));
});

afterAll(() => rm(dir, { recursive: true, force: true }));

describe('aiToken', () => {
    it('classifies API keys and OAuth tokens', () => {
        expect(classifyAiToken('sk-ant-api03-abc')).toEqual({ kind: 'api_key', value: 'sk-ant-api03-abc' });
        expect(classifyAiToken('  sk-ant-oat01-abc\n')).toEqual({ kind: 'oauth', value: 'sk-ant-oat01-abc' });
    });

    it.each(['', 'hello', 'sk-ant-xyz', 'sk-ant-api03 two words', 'Bearer sk-ant-api03-abc'])('rejects %j', (raw) => {
        expect(classifyAiToken(raw)).toBeNull();
    });

    it('reads and trims the token file; missing or empty is null', async () => {
        const file = path.join(dir, 'ai_token');
        await writeFile(file, 'sk-ant-api03-filed\n');
        expect(await readAiToken(file)).toEqual({ kind: 'api_key', value: 'sk-ant-api03-filed' });
        await writeFile(file, '  \n');
        expect(await readAiToken(file)).toBeNull();
        expect(await readAiToken(path.join(dir, 'missing'))).toBeNull();
    });

    it('puts only the matching variable into the docker client env', () => {
        const env = tokenEnv(
            { kind: 'oauth', value: 'sk-ant-oat01-x' },
            { PATH: '/bin', ANTHROPIC_API_KEY: 'stale', CLAUDE_CODE_OAUTH_TOKEN: 'stale' }
        );
        expect(env).toEqual({ PATH: '/bin', CLAUDE_CODE_OAUTH_TOKEN: 'sk-ant-oat01-x' });
    });
});
