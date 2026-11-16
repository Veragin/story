import { AI_TOKEN_ENV, tokenEnv, type TAiToken } from '../aiToken';
import type { TLaunchRequest } from '../launchRequest';
import { commandOutputLines, NODE_DOCKER_CLI, startAgentChild, type TDockerCli } from './dockerCli';
import {
    AGENT_LABEL,
    agentContainerName,
    claudeArgs,
    CONTAINER_STORY_DIR,
    STORY_MOUNT_FOLDERS,
    type TDockerRunConfig,
} from './dockerArgs';
import type { TAiSandboxDriver, TSandboxHealth, TSpawnedAgent } from './TAiSandboxDriver';

export const dockerSandboxArgs = (
    storiesHostDir: string,
    launch: TLaunchRequest & { containerName: string; tokenEnvName: string }
): string[] => [
    'sandbox',
    'run',
    '--name',
    launch.containerName,
    '-e',
    launch.tokenEnvName,
    ...STORY_MOUNT_FOLDERS.flatMap((folder) => [
        '-v',
        `${storiesHostDir}/${launch.storyId}/${folder}:${CONTAINER_STORY_DIR}/${folder}`,
    ]),
    'claude',
    ...claudeArgs(launch),
];

// UNVERIFIED: the `docker sandbox` flags are a best guess pending the phase 1 spike (Docker Desktop only)
export class DockerSandboxDriver implements TAiSandboxDriver {
    readonly name = 'docker-sandbox';

    private readonly storiesHostDir: string;

    constructor(
        config: TDockerRunConfig,
        private readonly token: TAiToken | null,
        private readonly docker: TDockerCli = NODE_DOCKER_CLI
    ) {
        if (config.stories.kind !== 'bind') throw new Error('docker-sandbox needs AI_STORIES_HOST_DIR');
        this.storiesHostDir = config.stories.hostDir;
    }

    async spawn(request: TLaunchRequest): Promise<TSpawnedAgent> {
        if (!this.token) throw new Error('No Anthropic token');
        const containerName = agentContainerName(request.storyId);
        const args = dockerSandboxArgs(this.storiesHostDir, {
            ...request,
            containerName,
            tokenEnvName: AI_TOKEN_ENV[this.token.kind],
        });
        return await startAgentChild(this.docker.spawn(args, tokenEnv(this.token, process.env)), containerName);
    }

    async stop(containerName: string): Promise<void> {
        await this.docker.run(['sandbox', 'stop', containerName]);
    }

    async remove(containerName: string): Promise<void> {
        await this.docker.run(['sandbox', 'rm', containerName]);
    }

    async cleanupOrphans(): Promise<number> {
        const listed = await this.docker.run(['sandbox', 'ls', '--format', '{{.Name}}']);
        if (listed.code !== 0) return 0;
        const names = commandOutputLines(listed.stdout).filter((name) => name.startsWith(`${AGENT_LABEL}-`));
        await Promise.all(names.map((name) => this.remove(name)));
        return names.length;
    }

    async ensureNetwork(): Promise<'exists' | 'created'> {
        await Promise.resolve();
        return 'exists';
    }

    async health(): Promise<TSandboxHealth> {
        const [version, sandbox] = await Promise.all([
            this.docker.run(['version', '--format', '{{.Server.Version}}']),
            this.docker.run(['sandbox', 'version']),
        ]);
        return { docker: version.code === 0 ? version.stdout.trim() || null : null, image: sandbox.code === 0 };
    }
}
