import { execFile, spawn } from 'node:child_process';
import type { TAgentChild } from './TAiSandboxDriver';

export type TCommandResult = { code: number; stdout: string; stderr: string };

export type TDockerCli = {
    spawn: (args: readonly string[], env: NodeJS.ProcessEnv) => TAgentChild;
    run: (args: readonly string[]) => Promise<TCommandResult>;
};

const COMMAND_TIMEOUT_MS = 30_000;

const exitCode = (error: Error | null): number => {
    if (!error) return 0;
    return 'code' in error && typeof error.code === 'number' ? error.code : -1;
};

export const NODE_DOCKER_CLI: TDockerCli = {
    spawn: (args, env) => spawn('docker', args, { env, stdio: 'pipe' }),
    run: (args) =>
        new Promise((resolve) => {
            execFile('docker', args, { timeout: COMMAND_TIMEOUT_MS }, (error, stdout, stderr) =>
                resolve({ code: exitCode(error), stdout, stderr })
            );
        }),
};

export const commandOutputLines = (stdout: string): string[] =>
    stdout
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

export const startAgentChild = async (child: TAgentChild, containerName: string) => {
    await new Promise<void>((resolve, reject) => {
        const onError = (error: Error) => {
            child.off('spawn', onSpawn);
            reject(error);
        };
        const onSpawn = () => {
            child.off('error', onError);
            resolve();
        };
        child.once('spawn', onSpawn);
        child.once('error', onError);
    });
    if (child.pid === undefined) throw new Error('docker client has no pid');
    return { child, pid: child.pid, containerName };
};
