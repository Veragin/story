import { describe, expect, it } from 'vitest';
import { launcherOptionsFromEnv } from '../../aiLauncher/launcherOptions';

describe('launcherOptionsFromEnv', () => {
    it('applies the defaults for prod', () => {
        expect(launcherOptionsFromEnv({ AI_STORIES_VOLUME: 'story-prod_stories' })).toEqual({
            tokenFile: '/secret/ai_token',
            keyFile: '/secret/ai_launcher_key',
            port: 8155,
            driver: 'docker-run',
            image: 'story-ai:latest',
            stories: { kind: 'volume', volume: 'story-prod_stories' },
            repoHostDir: null,
            sessionsVolume: 'story-ai-sessions',
            network: 'story-ai',
            instance: 'prod',
            models: ['claude-sonnet-5-5', 'claude-opus-5-5'],
            maxBudgetUsd: 5,
        });
    });

    it('reads the dev host dirs and overrides', () => {
        const options = launcherOptionsFromEnv({
            AI_STORIES_HOST_DIR: '/home/dev/story/stories/',
            AI_REPO_HOST_DIR: '/home/dev/story',
            AI_SANDBOX_DRIVER: 'docker-sandbox',
            AI_MODELS: ' claude-opus-5-5 , ',
            AI_MAX_BUDGET_USD: '2',
            AI_LAUNCHER_PORT: '9000',
            AI_INSTANCE: 'dev',
        });
        expect(options.stories).toEqual({ kind: 'bind', hostDir: '/home/dev/story/stories' });
        expect(options.repoHostDir).toBe('/home/dev/story');
        expect(options.driver).toBe('docker-sandbox');
        expect(options.models).toEqual(['claude-opus-5-5']);
        expect(options.maxBudgetUsd).toBe(2);
        expect(options.port).toBe(9000);
        expect(options.instance).toBe('dev');
    });

    it.each([
        [{}],
        [{ AI_STORIES_VOLUME: 'v', AI_STORIES_HOST_DIR: '/x' }],
        [{ AI_STORIES_HOST_DIR: 'relative/stories' }],
        [{ AI_STORIES_HOST_DIR: '/x,readonly=false' }],
        [{ AI_STORIES_VOLUME: 'bad volume' }],
        [{ AI_STORIES_VOLUME: 'v', AI_SANDBOX_DRIVER: 'podman' }],
        [{ AI_STORIES_VOLUME: 'v', AI_MAX_BUDGET_USD: '0' }],
        [{ AI_STORIES_VOLUME: 'v', AI_NETWORK: '--privileged' }],
        [{ AI_STORIES_VOLUME: 'v', AI_INSTANCE: 'dev,x' }],
    ])('rejects %j', (env) => {
        expect(() => launcherOptionsFromEnv(env)).toThrow();
    });
});
