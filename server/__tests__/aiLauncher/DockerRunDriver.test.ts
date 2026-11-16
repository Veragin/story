import { describe, expect, it } from 'vitest';
import type { TCommandResult, TDockerCli } from '../../aiLauncher/sandbox/dockerCli';
import { DockerRunDriver } from '../../aiLauncher/sandbox/DockerRunDriver';
import { FakeChild } from './fakeAgent';

const TOKEN = { kind: 'api_key' as const, value: 'sk-ant-api03-secret' };

const CONFIG = {
    image: 'story-ai:latest',
    network: 'story-ai',
    instance: 'dev',
    stories: { kind: 'volume' as const, volume: 'stories' },
    repoHostDir: null,
    sessionsVolume: 'story-ai-sessions',
};

class FakeDockerCli implements TDockerCli {
    readonly spawned: { args: readonly string[]; env: NodeJS.ProcessEnv; child: FakeChild }[] = [];
    readonly ran: string[] = [];
    results: Record<string, TCommandResult> = {};

    spawn = (args: readonly string[], env: NodeJS.ProcessEnv) => {
        const child = new FakeChild(777);
        this.spawned.push({ args, env, child });
        setImmediate(() => child.emit('spawn'));
        return child;
    };

    run = async (args: readonly string[]): Promise<TCommandResult> => {
        await Promise.resolve();
        this.ran.push(args.join(' '));
        return this.results[args[0]] ?? { code: 0, stdout: '', stderr: '' };
    };
}

describe('DockerRunDriver', () => {
    it('spawns docker run with the token only in the env', async () => {
        const docker = new FakeDockerCli();
        const agent = await new DockerRunDriver(CONFIG, TOKEN, docker).spawn({ storyId: 'demo', maxBudgetUsd: 1 });
        const [{ args, env }] = docker.spawned;
        expect(agent.pid).toBe(777);
        expect(agent.containerName).toMatch(/^story-ai-demo-[0-9a-f]{8}$/);
        expect(args).toContain(agent.containerName);
        expect(args.join(' ')).not.toContain(TOKEN.value);
        expect(env.ANTHROPIC_API_KEY).toBe(TOKEN.value);
    });

    it('rejects when the docker client fails to start', async () => {
        const docker = new FakeDockerCli();
        docker.spawn = () => {
            const child = new FakeChild(undefined);
            setImmediate(() => child.emit('error', new Error('spawn docker ENOENT')));
            return child;
        };
        await expect(
            new DockerRunDriver(CONFIG, TOKEN, docker).spawn({ storyId: 'demo', maxBudgetUsd: 1 })
        ).rejects.toThrow('ENOENT');
    });

    it('refuses to spawn without a token', async () => {
        await expect(
            new DockerRunDriver(CONFIG, null, new FakeDockerCli()).spawn({ storyId: 'demo', maxBudgetUsd: 1 })
        ).rejects.toThrow('No Anthropic token');
    });

    it('stops, removes and cleans up labelled containers', async () => {
        const docker = new FakeDockerCli();
        docker.results.ps = { code: 0, stdout: 'abc\ndef\n', stderr: '' };
        const driver = new DockerRunDriver(CONFIG, TOKEN, docker);
        await driver.stop('story-ai-demo-1');
        await driver.remove('story-ai-demo-1');
        expect(await driver.cleanupOrphans()).toBe(2);
        expect(docker.ran).toEqual([
            'stop -t 5 story-ai-demo-1',
            'rm -f story-ai-demo-1',
            'ps -aq --filter label=story-ai=1 --filter label=story-ai.instance=dev',
            'rm -f abc def',
        ]);
    });

    it('keeps an existing agent network', async () => {
        const docker = new FakeDockerCli();
        expect(await new DockerRunDriver(CONFIG, TOKEN, docker).ensureNetwork()).toBe('exists');
        expect(docker.ran).toEqual(['network inspect story-ai']);
    });

    it('creates the agent network when it is missing', async () => {
        const docker = new FakeDockerCli();
        docker.run = async (args) => {
            await Promise.resolve();
            docker.ran.push(args.join(' '));
            return { code: args[1] === 'inspect' ? 1 : 0, stdout: '', stderr: '' };
        };
        expect(await new DockerRunDriver(CONFIG, TOKEN, docker).ensureNetwork()).toBe('created');
        expect(docker.ran).toEqual(['network inspect story-ai', 'network create story-ai']);
    });

    it('fails when the agent network cannot be created', async () => {
        const docker = new FakeDockerCli();
        docker.results.network = { code: 1, stdout: '', stderr: 'permission denied' };
        await expect(new DockerRunDriver(CONFIG, TOKEN, docker).ensureNetwork()).rejects.toThrow('permission denied');
    });

    it('reports docker and image health', async () => {
        const docker = new FakeDockerCli();
        docker.results.version = { code: 0, stdout: '27.3.1\n', stderr: '' };
        docker.results.image = { code: 1, stdout: '', stderr: 'No such image' };
        expect(await new DockerRunDriver(CONFIG, TOKEN, docker).health()).toEqual({ docker: '27.3.1', image: false });
    });
});
