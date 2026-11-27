import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_AGENTS_CONFIG } from '../../aiLauncher/agentsConfig';
import { launcherOptionsFromEnv } from '../../aiLauncher/launcherOptions';

let dir: string;
let missingConfig: string;

beforeAll(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'story-launcher-options-'));
    missingConfig = path.join(dir, 'missing.json');
});

afterAll(() => rm(dir, { recursive: true, force: true }));

describe('launcherOptionsFromEnv', () => {
    it('applies the defaults for prod', () => {
        expect(
            launcherOptionsFromEnv({ AI_STORIES_VOLUME: 'story-prod_stories', AI_AGENTS_CONFIG_FILE: missingConfig })
        ).toEqual({
            tokenFile: '/secret/ai_token',
            geminiTokenFile: '/secret/gemini_token',
            keyFile: '/secret/ai_launcher_key',
            port: 8155,
            driver: 'docker-run',
            image: 'story-ai:latest',
            stories: { kind: 'volume', volume: 'story-prod_stories' },
            repoHostDir: null,
            sessionsVolume: 'story-ai-sessions',
            network: 'story-ai',
            instance: 'prod',
            agents: DEFAULT_AGENTS_CONFIG,
        });
    });

    it('reads the dev host dirs and overrides', () => {
        const options = launcherOptionsFromEnv({
            AI_STORIES_HOST_DIR: '/home/dev/story/stories/',
            AI_REPO_HOST_DIR: '/home/dev/story',
            AI_SANDBOX_DRIVER: 'docker-sandbox',
            AI_AGENTS_CONFIG_FILE: missingConfig,
            AI_LAUNCHER_PORT: '9000',
            AI_INSTANCE: 'dev',
        });
        expect(options.stories).toEqual({ kind: 'bind', hostDir: '/home/dev/story/stories' });
        expect(options.repoHostDir).toBe('/home/dev/story');
        expect(options.driver).toBe('docker-sandbox');
        expect(options.port).toBe(9000);
        expect(options.instance).toBe('dev');
    });

    it('reads the agents config file, with the deprecated AI_MODELS / AI_MAX_BUDGET_USD as fallbacks', async () => {
        const file = path.join(dir, 'ai_agents.json');
        await writeFile(file, JSON.stringify({ claude: { maxBudgetUsd: 3 } }));
        const lines: string[] = [];
        const options = launcherOptionsFromEnv(
            {
                AI_STORIES_VOLUME: 'v',
                AI_AGENTS_CONFIG_FILE: file,
                AI_MODELS: ' claude-opus-5-5 , ',
                AI_MAX_BUDGET_USD: '2',
            },
            (line) => lines.push(line)
        );
        expect(options.agents.claude).toEqual({
            models: ['claude-opus-5-5'],
            defaultModel: 'claude-opus-5-5',
            maxBudgetUsd: 3,
        });
        expect(lines).toEqual([
            expect.stringMatching(/^AI_MODELS is deprecated/),
            expect.stringMatching(/^AI_MAX_BUDGET_USD is deprecated/),
        ]);
    });

    it('ignores blank deprecated variables', () => {
        const lines: string[] = [];
        const options = launcherOptionsFromEnv(
            { AI_STORIES_VOLUME: 'v', AI_AGENTS_CONFIG_FILE: missingConfig, AI_MODELS: ' ', AI_MAX_BUDGET_USD: '' },
            (line) => lines.push(line)
        );
        expect(options.agents).toEqual(DEFAULT_AGENTS_CONFIG);
        expect(lines).toEqual([]);
    });

    it.each([
        [{}],
        [{ AI_STORIES_VOLUME: 'v', AI_STORIES_HOST_DIR: '/x' }],
        [{ AI_STORIES_HOST_DIR: 'relative/stories' }],
        [{ AI_STORIES_HOST_DIR: '/x,readonly=false' }],
        [{ AI_STORIES_VOLUME: 'bad volume' }],
        [{ AI_STORIES_VOLUME: 'v', AI_SANDBOX_DRIVER: 'podman' }],
        [{ AI_STORIES_VOLUME: 'v', AI_MAX_BUDGET_USD: '0' }],
        [{ AI_STORIES_VOLUME: 'v', AI_MAX_BUDGET_USD: 'five' }],
        [{ AI_STORIES_VOLUME: 'v', AI_MODELS: 'bad model' }],
        [{ AI_STORIES_VOLUME: 'v', AI_NETWORK: '--privileged' }],
        [{ AI_STORIES_VOLUME: 'v', AI_INSTANCE: 'dev,x' }],
    ])('rejects %j', (env) => {
        expect(() => launcherOptionsFromEnv({ AI_AGENTS_CONFIG_FILE: missingConfig, ...env })).toThrow();
    });
});
