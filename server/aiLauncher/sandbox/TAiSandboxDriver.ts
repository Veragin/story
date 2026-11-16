import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import type { TSandboxDriverName } from '../launcherOptions';
import type { TLaunchRequest } from '../launchRequest';

export type TAgentChild = Pick<ChildProcessWithoutNullStreams, 'pid' | 'stdin' | 'stdout' | 'stderr' | 'kill'> &
    NodeJS.EventEmitter;

export type TSpawnedAgent = { child: TAgentChild; pid: number; containerName: string };

export type TSandboxHealth = { docker: string | null; image: boolean };

export type TAiSandboxDriver = {
    readonly name: TSandboxDriverName;
    spawn: (request: TLaunchRequest) => Promise<TSpawnedAgent>;
    stop: (containerName: string) => Promise<void>;
    remove: (containerName: string) => Promise<void>;
    cleanupOrphans: () => Promise<number>;
    ensureNetwork: () => Promise<'exists' | 'created'>;
    health: () => Promise<TSandboxHealth>;
};
