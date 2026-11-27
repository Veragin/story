import type { TAiToken } from '../aiToken';
import type { TLauncherOptions } from '../launcherOptions';
import { DockerRunDriver } from './DockerRunDriver';
import { DockerSandboxDriver } from './DockerSandboxDriver';
import type { TAiSandboxDriver } from './TAiSandboxDriver';

export const createSandboxDriver = (options: TLauncherOptions, token: TAiToken | null): TAiSandboxDriver => {
    const config = {
        image: options.image,
        network: options.network,
        instance: options.instance,
        stories: options.stories,
        repoHostDir: options.repoHostDir,
        sessionsVolume: options.sessionsVolume,
    };
    return options.driver === 'docker-sandbox'
        ? new DockerSandboxDriver(config, token)
        : new DockerRunDriver(config, token);
};
