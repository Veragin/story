import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import type { TLaunchRequest } from '../../aiLauncher/launchRequest';
import type { TAiSandboxDriver, TSandboxHealth, TSpawnedAgent } from '../../aiLauncher/sandbox/TAiSandboxDriver';

export class FakeChild extends EventEmitter {
    readonly stdin = new PassThrough();
    readonly stdout = new PassThrough();
    readonly stderr = new PassThrough();
    readonly signals: string[] = [];

    constructor(readonly pid: number | undefined = 4242) {
        super();
    }

    kill(signal?: NodeJS.Signals | number): boolean {
        this.signals.push(String(signal ?? 'SIGTERM'));
        return true;
    }

    exit(code: number | null): void {
        this.stdout.end();
        this.stderr.end();
        setImmediate(() => this.emit('close', code, null));
    }
}

export class FakeDriver implements TAiSandboxDriver {
    readonly name = 'docker-run';
    readonly requests: TLaunchRequest[] = [];
    readonly children: FakeChild[] = [];
    readonly calls: string[] = [];
    orphans = 0;
    failSpawn: Error | null = null;
    healthResult: TSandboxHealth = { docker: '27.0.1', image: true };

    async spawn(request: TLaunchRequest): Promise<TSpawnedAgent> {
        await Promise.resolve();
        if (this.failSpawn) throw this.failSpawn;
        this.requests.push(request);
        const child = new FakeChild(4242 + this.children.length);
        this.children.push(child);
        return { child, pid: child.pid ?? 0, containerName: `story-ai-${request.storyId}-${this.children.length}` };
    }

    async stop(containerName: string): Promise<void> {
        await Promise.resolve();
        this.calls.push(`stop ${containerName}`);
    }

    async remove(containerName: string): Promise<void> {
        await Promise.resolve();
        this.calls.push(`rm ${containerName}`);
    }

    async cleanupOrphans(): Promise<number> {
        await Promise.resolve();
        this.calls.push('cleanup');
        return this.orphans;
    }

    async ensureNetwork(): Promise<'exists' | 'created'> {
        await Promise.resolve();
        this.calls.push('network');
        return 'exists';
    }

    async health(): Promise<TSandboxHealth> {
        await Promise.resolve();
        return this.healthResult;
    }

    lastChild(): FakeChild {
        const child = this.children.at(-1);
        if (!child) throw new Error('no agent was spawned');
        return child;
    }
}
