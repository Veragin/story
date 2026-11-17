import { describe, expect, it } from 'vitest';
import {
    agentContainerName,
    claudeArgs,
    dockerRunArgs,
    type TDockerRunConfig,
} from '../../aiLauncher/sandbox/dockerArgs';

const TOKEN = 'sk-ant-api03-secret';

const PROD: TDockerRunConfig = {
    image: 'story-ai:latest',
    network: 'story-ai',
    instance: 'prod',
    stories: { kind: 'volume', volume: 'story-prod_stories' },
    repoHostDir: '/srv/repo',
    sessionsVolume: 'story-ai-sessions',
};

const DEV: TDockerRunConfig = { ...PROD, stories: { kind: 'bind', hostDir: '/home/dev/story/stories' } };

const LAUNCH = {
    storyId: 'my-story',
    maxBudgetUsd: 2.5,
    containerName: 'story-ai-my-story-abcd1234',
    tokenKind: 'api_key' as const,
};

const valuesOf = (args: string[], flag: string): string[] =>
    args.flatMap((arg, i) => (arg === flag && i + 1 < args.length ? [args[i + 1]] : []));

const split = (args: string[]) => {
    const imageAt = args.indexOf(PROD.image);
    return { docker: args.slice(0, imageAt), claude: args.slice(imageAt + 1) };
};

describe('dockerRunArgs', () => {
    it('mounts only the story data/types volume subpaths and the sessions subpath in prod', () => {
        const { docker } = split(dockerRunArgs(PROD, LAUNCH));
        expect(valuesOf(docker, '--mount')).toEqual([
            'type=volume,src=story-prod_stories,dst=/repo/stories/story/data,volume-subpath=my-story/data',
            'type=volume,src=story-prod_stories,dst=/repo/stories/story/types,volume-subpath=my-story/types',
            'type=volume,src=story-ai-sessions,dst=/sessions,volume-subpath=my-story',
        ]);
        expect(docker).not.toContain('-v');
        expect(docker).not.toContain('--volume');
        expect(docker.join(' ')).not.toContain('/srv/repo');
    });

    it('bind-mounts the story folders and read-only engine sources in dev', () => {
        const mounts = valuesOf(split(dockerRunArgs(DEV, LAUNCH)).docker, '--mount');
        expect(mounts).toEqual([
            'type=bind,src=/srv/repo/tsconfig.base.json,dst=/repo/tsconfig.base.json,readonly',
            'type=bind,src=/srv/repo/clients/shared/core,dst=/repo/clients/shared/core,readonly',
            'type=bind,src=/srv/repo/clients/shared/utils,dst=/repo/clients/shared/utils,readonly',
            'type=bind,src=/srv/repo/clients/shared/ui,dst=/repo/clients/shared/ui,readonly',
            'type=bind,src=/srv/repo/node_modules/@types/react,dst=/repo/node_modules/@types/react,readonly',
            'type=bind,src=/srv/repo/node_modules/@mui/icons-material,dst=/repo/node_modules/@mui/icons-material,readonly',
            'type=bind,src=/home/dev/story/stories/my-story/data,dst=/repo/stories/story/data',
            'type=bind,src=/home/dev/story/stories/my-story/types,dst=/repo/stories/story/types',
            'type=volume,src=story-ai-sessions,dst=/sessions,volume-subpath=my-story',
        ]);
        const writable = mounts.filter((m) => !m.endsWith(',readonly')).map((m) => /dst=([^,]+)/.exec(m)?.[1]);
        expect(writable).toEqual([
            '/repo/stories/story/data',
            '/repo/stories/story/types',
            '/sessions',
        ]);
    });

    it('omits the engine mounts in dev without AI_REPO_HOST_DIR', () => {
        const mounts = valuesOf(dockerRunArgs({ ...DEV, repoHostDir: null }, LAUNCH), '--mount');
        expect(mounts).toHaveLength(3);
    });

    it('runs a hardened, labelled, read-only container as uid 1000', () => {
        const { docker } = split(dockerRunArgs(PROD, LAUNCH));
        expect(docker.slice(0, 5)).toEqual(['run', '--rm', '-i', '--name', 'story-ai-my-story-abcd1234']);
        expect(docker).toContain('--read-only');
        expect(valuesOf(docker, '--tmpfs')).toEqual(['/tmp', '/home/agent:rw,uid=1000,gid=1000,mode=0700,size=64m']);
        expect(valuesOf(docker, '--cap-drop')).toEqual(['ALL']);
        expect(valuesOf(docker, '--security-opt')).toEqual(['no-new-privileges']);
        expect(valuesOf(docker, '--pids-limit')).toEqual(['256']);
        expect(valuesOf(docker, '--memory')).toEqual(['1g']);
        expect(valuesOf(docker, '--cpus')).toEqual(['1']);
        expect(valuesOf(docker, '--user')).toEqual(['1000:1000']);
        expect(valuesOf(docker, '--network')).toEqual(['story-ai']);
        expect(valuesOf(docker, '--label')).toEqual([
            'story-ai=1',
            'story-ai.story-id=my-story',
            'story-ai.instance=prod',
        ]);
        expect(docker).not.toContain('--privileged');
    });

    it('passes the token by name only', () => {
        const apiKey = dockerRunArgs(PROD, LAUNCH);
        expect(valuesOf(apiKey, '-e')).toEqual(['ANTHROPIC_API_KEY']);
        expect(valuesOf(dockerRunArgs(PROD, { ...LAUNCH, tokenKind: 'oauth' }), '-e')).toEqual([
            'CLAUDE_CODE_OAUTH_TOKEN',
        ]);
        expect(apiKey.join(' ')).not.toContain(TOKEN);
        expect(apiKey.filter((arg) => arg.startsWith('ANTHROPIC_API_KEY='))).toEqual([]);
    });

    it('ends with the image and the stream-json claude args, budget and tool limits', () => {
        const { claude } = split(dockerRunArgs(PROD, LAUNCH));
        expect(claude).toEqual([
            '-p',
            '--input-format',
            'stream-json',
            '--output-format',
            'stream-json',
            '--verbose',
            '--permission-mode',
            'acceptEdits',
            '--allowedTools',
            'Read,Edit,Write,Glob,Grep,Skill',
            '--disallowedTools',
            'Bash,WebFetch,WebSearch',
            '--max-budget-usd',
            '2.5',
        ]);
    });

    it('adds --resume and --model only when given', () => {
        const args = claudeArgs({
            storyId: 'my-story',
            maxBudgetUsd: 0.01,
            resumeSessionId: '1b4e28ba-2fa1-11d2-883f-0016a7d3b4c1',
            model: 'claude-opus-5-5',
        });
        expect(valuesOf(args, '--max-budget-usd')).toEqual(['0.01']);
        expect(args.slice(-4)).toEqual([
            '--resume',
            '1b4e28ba-2fa1-11d2-883f-0016a7d3b4c1',
            '--model',
            'claude-opus-5-5',
        ]);
    });

    it('refuses a story id that is not a folder name', () => {
        expect(() => dockerRunArgs(PROD, { ...LAUNCH, storyId: '../etc' })).toThrow(/Invalid story id/);
        expect(() => dockerRunArgs(PROD, { ...LAUNCH, storyId: 'a,dst=/x' })).toThrow(/Invalid story id/);
        expect(() => agentContainerName('Bad Id')).toThrow(/Invalid story id/);
        expect(agentContainerName('my-story')).toMatch(/^story-ai-my-story-[0-9a-f]{8}$/);
    });
});
