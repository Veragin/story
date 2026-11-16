import { execFile, spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { once } from 'node:events';
import { homedir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { ndjsonLines, writeLine } from '../../../aiLauncher/ndjson';
import { claudeArgs } from '../../../aiLauncher/sandbox/dockerArgs';
import { errorMessage } from '../../common/HttpError';
import type {
    TAgentConnection,
    TAgentExit,
    TAgentLaunch,
    TAgentLayout,
    TAgentStream,
    TAiHealth,
} from './TAgentConnection';

const CLAUDE = 'claude';
const STDERR_TAIL_BYTES = 4096;

const run = promisify(execFile);

const projectsFolder = (cwd: string) => cwd.replace(/[^a-zA-Z0-9]/g, '-');

const collectTail = (child: ChildProcessWithoutNullStreams): (() => string) => {
    let tail = Buffer.alloc(0);
    child.stderr.on('data', (chunk: Buffer) => {
        const joined = Buffer.concat([tail, chunk]);
        tail = joined.subarray(Math.max(0, joined.length - STDERR_TAIL_BYTES));
    });
    return () => tail.toString('utf8');
};

// AI_SANDBOX=none (dev only): the CLI runs unsandboxed on the server, in the story folder, with the dev's own login
export class LocalConnection implements TAgentConnection {
    private readonly children = new Set<ChildProcessWithoutNullStreams>();

    constructor(
        private readonly storyDir: (storyId: string) => string,
        private readonly claudeHome = path.join(homedir(), '.claude')
    ) {}

    async health(): Promise<TAiHealth> {
        try {
            await run(CLAUDE, ['--version'], { timeout: 10_000 });
            return { available: true };
        } catch (e) {
            return { available: false, reason: `The claude CLI does not run: ${errorMessage(e)}` };
        }
    }

    layout(storyId: string): TAgentLayout {
        const storyRoot = this.storyDir(storyId);
        const sessionsRoot = path.join(this.claudeHome, 'projects', projectsFolder(storyRoot));
        return { storyRoot, sessionsRoot, transcriptsDir: sessionsRoot };
    }

    async cleanupAll(): Promise<number> {
        const children = [...this.children];
        for (const child of children) child.kill('SIGTERM');
        await Promise.all(children.map((child) => (child.exitCode === null ? once(child, 'close') : null)));
        return children.length;
    }

    async open(launch: TAgentLaunch): Promise<TAgentStream> {
        const child = spawn(CLAUDE, claudeArgs(launch), { cwd: this.storyDir(launch.storyId), stdio: 'pipe' });
        // rejects on the 'error' of a missing binary
        await once(child, 'spawn');
        const pid = child.pid;
        if (pid === undefined) throw new Error('The claude CLI did not start');
        this.children.add(child);
        child.stdin.on('error', () => undefined);
        const stderrTail = collectTail(child);
        const exited = new Promise<TAgentExit>((resolve) => {
            child.once('close', (code: number | null) => {
                this.children.delete(child);
                resolve({ code, stderrTail: stderrTail() });
            });
        });
        return {
            handle: { pid, containerName: `local-${launch.storyId}-${pid}` },
            lines: ndjsonLines(child.stdout),
            exited,
            send: (line) => writeLine(child.stdin, line),
            interrupt: async () => {
                child.kill('SIGINT');
                await Promise.resolve();
            },
            close: () => {
                child.stdin.end();
                child.kill('SIGTERM');
            },
        };
    }
}
