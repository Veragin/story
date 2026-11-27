import { tokenEnv, type TAiToken } from '../aiToken';
import type { TLaunchRequest } from '../launchRequest';
import { commandOutputLines, NODE_DOCKER_CLI, startAgentChild, type TDockerCli } from './dockerCli';
import { agentContainerName, agentLabelFilters, dockerRunArgs, type TDockerRunConfig } from './dockerArgs';
import type { TAiSandboxDriver, TSandboxHealth, TSpawnedAgent } from './TAiSandboxDriver';

export class DockerRunDriver implements TAiSandboxDriver {
    readonly name = 'docker-run';

    constructor(
        private readonly config: TDockerRunConfig,
        private readonly token: TAiToken | null,
        private readonly docker: TDockerCli = NODE_DOCKER_CLI
    ) {}

    async spawn(request: TLaunchRequest): Promise<TSpawnedAgent> {
        if (!this.token) throw new Error('No Anthropic token');
        const containerName = agentContainerName(request.storyId);
        const args = dockerRunArgs(this.config, { ...request, containerName, tokenKind: this.token.kind });
        return await startAgentChild(this.docker.spawn(args, tokenEnv(this.token, process.env)), containerName);
    }

    async stop(containerName: string): Promise<void> {
        await this.docker.run(['stop', '-t', '5', containerName]);
    }

    async remove(containerName: string): Promise<void> {
        await this.docker.run(['rm', '-f', containerName]);
    }

    async cleanupOrphans(): Promise<number> {
        const listed = await this.docker.run(['ps', '-aq', ...agentLabelFilters(this.config.instance)]);
        if (listed.code !== 0) throw new Error(`docker ps failed (${listed.code}): ${listed.stderr.trim()}`);
        const ids = commandOutputLines(listed.stdout);
        if (ids.length === 0) return 0;
        const removed = await this.docker.run(['rm', '-f', ...ids]);
        if (removed.code !== 0) throw new Error(`docker rm failed (${removed.code}): ${removed.stderr.trim()}`);
        return ids.length;
    }

    async ensureNetwork(): Promise<'exists' | 'created'> {
        const inspected = await this.docker.run(['network', 'inspect', this.config.network]);
        if (inspected.code === 0) return 'exists';
        const created = await this.docker.run(['network', 'create', this.config.network]);
        if (created.code !== 0) {
            throw new Error(
                `docker network create ${this.config.network} failed (${created.code}): ${created.stderr.trim()}`
            );
        }
        return 'created';
    }

    async health(): Promise<TSandboxHealth> {
        const [version, image] = await Promise.all([
            this.docker.run(['version', '--format', '{{.Server.Version}}']),
            this.docker.run(['image', 'inspect', '--format', '{{.Id}}', this.config.image]),
        ]);
        return { docker: version.code === 0 ? version.stdout.trim() || null : null, image: image.code === 0 };
    }
}
