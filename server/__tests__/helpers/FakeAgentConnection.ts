import path from 'node:path';
import { TRANSCRIPTS_FOLDER } from '../../src/ai/agentConnection/LauncherConnection';
import type {
    TAgentConnection,
    TAgentExit,
    TAgentHandle,
    TAgentLaunch,
    TAgentLayout,
    TAgentStream,
    TAiHealth,
} from '../../src/ai/agentConnection/TAgentConnection';

export const FAKE_STORY_ROOT = '/repo/stories/story';

export const SESSION_ID = 'f3b1c2d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

export const initLine = (sessionId = SESSION_ID) =>
    JSON.stringify({ type: 'system', subtype: 'init', session_id: sessionId, model: 'claude-sonnet-5-5' });

export const textLine = (text: string, uuid = `u-${text}`) =>
    JSON.stringify({
        type: 'assistant',
        uuid,
        message: { id: `msg-${uuid}`, role: 'assistant', content: [{ type: 'text', text }] },
    });

export const editLine = (file: string, id = `toolu-${file}`) =>
    JSON.stringify({
        type: 'assistant',
        uuid: `u-${id}`,
        message: {
            id: `msg-${id}`,
            role: 'assistant',
            content: [{ type: 'tool_use', id, name: 'Edit', input: { file_path: `${FAKE_STORY_ROOT}/${file}` } }],
        },
    });

export const resultLine = (costUsd: number, sessionId = SESSION_ID, extra: Record<string, unknown> = {}) =>
    JSON.stringify({
        type: 'result',
        subtype: 'success',
        is_error: false,
        session_id: sessionId,
        total_cost_usd: costUsd,
        usage: { input_tokens: 10, output_tokens: 20, cache_read_input_tokens: 30, cache_creation_input_tokens: 40 },
        modelUsage: { 'claude-sonnet-5-5': {} },
        ...extra,
    });

// a scripted agent process: the test pushes CLI lines and decides when it exits
export class FakeAgentStream implements TAgentStream {
    readonly sent: string[] = [];
    readonly lines: AsyncIterable<string>;
    readonly exited: Promise<TAgentExit>;
    interrupts = 0;
    closed = false;
    private readonly queue: string[] = [];
    private wake: (() => void) | null = null;
    private ended = false;
    private resolveExit: (exit: TAgentExit) => void = () => undefined;

    constructor(
        readonly handle: TAgentHandle,
        readonly launch: TAgentLaunch,
        private readonly exitOnClose: boolean
    ) {
        this.exited = new Promise((resolve) => {
            this.resolveExit = resolve;
        });
        this.lines = this.read();
    }

    get userMessages(): string[] {
        return this.sent.flatMap((line) => {
            const message: unknown = JSON.parse(line);
            if (typeof message !== 'object' || message === null || !('type' in message)) return [];
            if (message.type !== 'user' || !('message' in message)) return [];
            const inner = message.message;
            return typeof inner === 'object' &&
                inner !== null &&
                'content' in inner &&
                typeof inner.content === 'string'
                ? [inner.content]
                : [];
        });
    }

    emit(...lines: string[]): void {
        this.queue.push(...lines);
        this.wake?.();
    }

    exit(code: number | null = 0, stderrTail = ''): void {
        if (this.ended) return;
        this.ended = true;
        this.resolveExit({ code, stderrTail });
        this.wake?.();
    }

    send = async (line: string): Promise<void> => {
        await Promise.resolve();
        this.sent.push(line);
    };

    interrupt = async (): Promise<void> => {
        await Promise.resolve();
        this.interrupts++;
    };

    close = (): void => {
        this.closed = true;
        if (this.exitOnClose) this.exit(143, '');
    };

    private async *read(): AsyncGenerator<string> {
        for (;;) {
            const next = this.queue.shift();
            if (next !== undefined) {
                yield next;
                continue;
            }
            if (this.ended) return;
            await new Promise<void>((resolve) => {
                this.wake = resolve;
            });
            this.wake = null;
        }
    }
}

export class FakeAgentConnection implements TAgentConnection {
    healthResult: TAiHealth = { available: true };
    readonly launches: TAgentLaunch[] = [];
    readonly streams: FakeAgentStream[] = [];
    failOpen: Error | null = null;
    exitOnClose = true;
    cleanups = 0;
    orphans = 0;
    failCleanup: Error | null = null;

    constructor(readonly sessionsDir: string) {}

    async health(): Promise<TAiHealth> {
        await Promise.resolve();
        return this.healthResult;
    }

    async open(launch: TAgentLaunch): Promise<TAgentStream> {
        await Promise.resolve();
        this.launches.push(launch);
        if (this.failOpen) throw this.failOpen;
        const n = this.streams.length + 1;
        const stream = new FakeAgentStream(
            { pid: 1000 + n, containerName: `story-ai-${launch.storyId}-${n}` },
            launch,
            this.exitOnClose
        );
        this.streams.push(stream);
        return stream;
    }

    async cleanupAll(): Promise<number> {
        await Promise.resolve();
        this.cleanups++;
        if (this.failCleanup) throw this.failCleanup;
        return this.orphans;
    }

    layout(storyId: string): TAgentLayout {
        const sessionsRoot = path.join(this.sessionsDir, storyId);
        return {
            storyRoot: FAKE_STORY_ROOT,
            sessionsRoot,
            transcriptsDir: path.join(sessionsRoot, TRANSCRIPTS_FOLDER),
        };
    }

    last(): FakeAgentStream {
        const stream = this.streams.at(-1);
        if (!stream) throw new Error('no agent was opened');
        return stream;
    }
}
