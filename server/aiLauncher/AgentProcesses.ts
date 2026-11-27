import type { TLaunchRequest } from './launchRequest';
import type { TAgentChild, TAiSandboxDriver } from './sandbox/TAiSandboxDriver';

export type TAgentExit = { code: number | null; signal: NodeJS.Signals | null };

export type TAgentSummary = { containerName: string; storyId: string; pid: number };

export type TRunningAgent = TAgentSummary & {
    child: TAgentChild;
    exited: Promise<TAgentExit>;
    stderrTail: () => string;
};

export type TAgentTiming = { removeAfterMs: number; stderrTailBytes: number };

const DEFAULT_TIMING: TAgentTiming = { removeAfterMs: 10_000, stderrTailBytes: 4096 };

type TAgentEntry = TRunningAgent & { stopping: Promise<void> | null };

const exitOf = (child: TAgentChild): Promise<TAgentExit> =>
    new Promise((resolve) => {
        child.once('close', (code: number | null, signal: NodeJS.Signals | null) => resolve({ code, signal }));
    });

const collectTail = (child: TAgentChild, maxBytes: number): (() => string) => {
    let tail = Buffer.alloc(0);
    child.stderr.on('data', (chunk: Buffer) => {
        const joined = Buffer.concat([tail, chunk]);
        tail = joined.subarray(Math.max(0, joined.length - maxBytes));
    });
    return () => tail.toString('utf8');
};

const withTimeout = async <T>(task: Promise<T>, ms: number): Promise<T | 'timeout'> => {
    let timer: NodeJS.Timeout | undefined;
    try {
        return await Promise.race([
            task,
            new Promise<'timeout'>((resolve) => {
                timer = setTimeout(() => resolve('timeout'), ms);
            }),
        ]);
    } finally {
        clearTimeout(timer);
    }
};

export class AgentProcesses {
    private readonly agents = new Map<string, TAgentEntry>();

    constructor(
        private readonly driver: TAiSandboxDriver,
        private readonly timing: TAgentTiming = DEFAULT_TIMING,
        private readonly log: (message: string) => void = console.error
    ) {}

    async start(request: TLaunchRequest): Promise<TRunningAgent> {
        const { child, pid, containerName } = await this.driver.spawn(request);
        const entry: TAgentEntry = {
            containerName,
            storyId: request.storyId,
            pid,
            child,
            exited: exitOf(child),
            stderrTail: collectTail(child, this.timing.stderrTailBytes),
            stopping: null,
        };
        child.stdin.on('error', () => undefined);
        this.agents.set(containerName, entry);
        const forgetOnExit = async () => {
            await entry.exited;
            this.agents.delete(containerName);
        };
        void forgetOnExit();
        return entry;
    }

    list(): TAgentSummary[] {
        return [...this.agents.values()].map(({ containerName, storyId, pid }) => ({ containerName, storyId, pid }));
    }

    interrupt(containerName: string): boolean {
        const entry = this.agents.get(containerName);
        return entry ? entry.child.kill('SIGINT') : false;
    }

    async stop(containerName: string): Promise<boolean> {
        const entry = this.agents.get(containerName);
        if (!entry) return false;
        entry.stopping ??= this.runStopSequence(entry);
        await entry.stopping;
        return true;
    }

    async stopAll(): Promise<void> {
        await Promise.all([...this.agents.keys()].map((name) => this.stop(name)));
    }

    async ensureNetwork(): Promise<'exists' | 'created'> {
        return await this.driver.ensureNetwork();
    }

    async cleanupOrphans(): Promise<number> {
        return await this.driver.cleanupOrphans();
    }

    private async runStopSequence(entry: TAgentEntry): Promise<void> {
        entry.child.stdin.end();
        entry.child.kill('SIGTERM');
        const dockerStop = this.guard(this.driver.stop(entry.containerName), `docker stop ${entry.containerName}`);
        const outcome = await withTimeout(entry.exited, this.timing.removeAfterMs);
        if (outcome === 'timeout') {
            await this.guard(this.driver.remove(entry.containerName), `docker rm -f ${entry.containerName}`);
            entry.child.kill('SIGKILL');
        }
        await dockerStop;
    }

    private async guard(task: Promise<void>, what: string): Promise<void> {
        try {
            await task;
        } catch (e) {
            this.log(`${what} failed: ${e instanceof Error ? e.message : String(e)}`);
        }
    }
}
