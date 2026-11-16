import { randomUUID } from 'node:crypto';
import type { TAiEvent, TAiMessageDto, TAiStatus, TAiTokensDto } from '@story/protocol';
import { errorMessage } from '../common/HttpError';
import type { TAgentConnection, TAgentExit, TAgentHandle, TAgentStream } from './agentConnection/TAgentConnection';
import {
    interruptLine,
    parseStreamLine,
    userLine,
    type TStreamContext,
    type TStreamItem,
    type TStreamResult,
} from './streamJson';
import { addTokens, creditsOf, NO_TOKENS, tokensDto } from './usage';

export type TAiAgentHooks = {
    // the budget for a new process in USD (≤ 0: no credits); prepares whatever the spawn needs
    prepareLaunch: () => Promise<number>;
    // `title` is the first prompt of the session
    sessionStarted: (sessionId: string, handle: TAgentHandle, title: string) => Promise<void>;
    // charges the turn and returns the new balance
    turnFinished: (sessionId: string, result: TStreamResult) => Promise<number>;
    processExited: (sessionId: string | null) => Promise<void>;
};

export type TAiAgentDeps = {
    storyId: string;
    connection: TAgentConnection;
    hooks: TAiAgentHooks;
    model: string;
    maxTurnMs: number;
    interruptFallbackMs?: number;
    log?: (message: string) => void;
};

export type TSendOutcome = 'sent' | 'busy' | 'failed';

type TListener = (event: TAiEvent) => void;

export const SESSION_TITLE_MAX = 120;
const DEFAULT_INTERRUPT_FALLBACK_MS = 3000;
const STDERR_TAIL_SHOWN = 600;
const STOPPED = 'The agent stopped';

const exitMessage = ({ code, stderrTail }: TAgentExit): string => {
    const tail = stderrTail.trim().slice(-STDERR_TAIL_SHOWN);
    const head = code === 0 ? STOPPED : `The agent exited${code === null ? '' : ` with code ${code}`}`;
    return tail ? `${head}: ${tail}` : head;
};

const minutes = (ms: number) => Math.max(1, Math.round(ms / 60_000));

// one story's agent: the transcript and state survive process restarts, so a later message resumes the session
export class AiAgent {
    private statusValue: TAiStatus = 'stopped';
    private session: string | null = null;
    private transcript: TAiMessageDto[] = [];
    private touched: string[] = [];
    private sessionTokens: TAiTokensDto = NO_TOKENS;
    private readonly listeners = new Set<TListener>();
    private stream: TAgentStream | null = null;
    private starting: Promise<TAgentStream | null> | null = null;
    private pump: Promise<void> | null = null;
    private turn = false;
    private turnTimer: NodeJS.Timeout | null = null;
    private fallbackTimer: NodeJS.Timeout | null = null;
    private interrupts = 0;
    private title: string | null = null;
    private sessionReported = false;
    private stopMessage: string | null = null;
    private readonly log: (message: string) => void;
    private readonly storyRoot: string;

    constructor(private readonly deps: TAiAgentDeps) {
        this.log = deps.log ?? (() => undefined);
        this.storyRoot = deps.connection.layout(deps.storyId).storyRoot;
    }

    get status(): TAiStatus {
        return this.statusValue;
    }

    get sessionId(): string | null {
        return this.session;
    }

    get running(): boolean {
        return this.stream !== null || this.starting !== null;
    }

    get busy(): boolean {
        return this.turn;
    }

    get tokens(): TAiTokensDto {
        return this.sessionTokens;
    }

    get messages(): readonly TAiMessageDto[] {
        return this.transcript;
    }

    subscribe(listener: TListener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    snapshot(credits: number, status: TAiStatus = this.statusValue): TAiEvent {
        return {
            type: 'snapshot',
            status,
            credits,
            sessionId: this.session,
            messages: [...this.transcript],
            touchedFiles: [...this.touched],
        };
    }

    broadcastSnapshot(credits: number): void {
        this.emit(this.snapshot(credits));
    }

    say(text: string): void {
        this.addMessage({ kind: 'system', id: randomUUID(), text, at: new Date().toISOString() });
    }

    setStatus(status: TAiStatus, message?: string): void {
        this.statusValue = status;
        this.emit(message === undefined ? { type: 'status', status } : { type: 'status', status, message });
    }

    async start(): Promise<boolean> {
        if (this.stream) return true;
        this.starting ??= this.launch();
        try {
            return (await this.starting) !== null;
        } finally {
            this.starting = null;
        }
    }

    async send(text: string): Promise<TSendOutcome> {
        if (this.turn) return 'busy';
        this.turn = true;
        if (this.session === null && this.title === null) this.title = text.slice(0, SESSION_TITLE_MAX);
        this.addMessage({ kind: 'user', id: randomUUID(), text, at: new Date().toISOString() });
        const stream = (await this.start()) ? this.stream : null;
        if (!stream) {
            this.turn = false;
            return 'failed';
        }
        this.setStatus('busy');
        this.armTurnTimer();
        await stream.send(userLine(text));
        return 'sent';
    }

    async interrupt(): Promise<void> {
        const stream = this.stream;
        if (!this.turn || !stream) return;
        await stream.send(interruptLine(`interrupt-${++this.interrupts}`));
        // which of the two the CLI honours is for the spike to confirm (plan 2.3)
        this.clearFallbackTimer();
        this.fallbackTimer = setTimeout(() => {
            this.fallbackTimer = null;
            if (this.turn && this.stream === stream) void stream.interrupt();
        }, this.deps.interruptFallbackMs ?? DEFAULT_INTERRUPT_FALLBACK_MS);
        this.fallbackTimer.unref();
    }

    async stop(message: string | null = null): Promise<void> {
        const pending = this.starting;
        if (pending) await pending;
        const stream = this.stream;
        const pump = this.pump;
        if (!stream || !pump) return;
        this.stopMessage = message ?? STOPPED;
        stream.close();
        await pump;
    }

    reset(): void {
        this.session = null;
        this.transcript = [];
        this.touched = [];
        this.sessionTokens = NO_TOKENS;
        this.title = null;
    }

    load(sessionId: string, messages: TAiMessageDto[]): void {
        this.reset();
        this.session = sessionId;
        this.transcript = [...messages];
    }

    private async launch(): Promise<TAgentStream | null> {
        this.setStatus('starting');
        try {
            const maxBudgetUsd = await this.deps.hooks.prepareLaunch();
            if (maxBudgetUsd <= 0) {
                this.setStatus('no_credits', 'The story has no AI credits left');
                return null;
            }
            const stream = await this.deps.connection.open({
                storyId: this.deps.storyId,
                maxBudgetUsd,
                model: this.deps.model,
                ...(this.session ? { resumeSessionId: this.session } : {}),
            });
            this.stream = stream;
            this.sessionReported = false;
            this.stopMessage = null;
            this.pump = this.run(stream);
            this.setStatus('ready');
            return stream;
        } catch (e) {
            const message = errorMessage(e);
            this.log(`agent for ${this.deps.storyId} did not start: ${message}`);
            this.setStatus('error', `The agent could not start: ${message}`);
            return null;
        }
    }

    private async run(stream: TAgentStream): Promise<void> {
        try {
            for await (const line of stream.lines) {
                await this.guard(this.handle(parseStreamLine(line, this.context()), stream), 'an agent line');
            }
        } catch (e) {
            this.log(`the agent stream of ${this.deps.storyId} broke: ${errorMessage(e)}`);
        }
        const exit = await stream.exited;
        this.stream = null;
        this.pump = null;
        this.endTurn();
        await this.guard(this.deps.hooks.processExited(this.session), 'clearing the running agent');
        this.setStatus('stopped', this.stopMessage ?? exitMessage(exit));
    }

    private context(): TStreamContext {
        return { storyRoot: this.storyRoot, at: new Date().toISOString(), nextId: randomUUID };
    }

    private async handle(item: TStreamItem | null, stream: TAgentStream): Promise<void> {
        if (item === null) return;
        switch (item.type) {
            case 'init':
                return await this.started(item.sessionId, stream.handle);
            case 'messages':
                for (const message of item.messages) this.addMessage(message);
                return this.touch(item.editedFiles);
            case 'result':
                for (const message of item.messages) this.addMessage(message);
                return await this.finished(item.result);
            case 'control_response':
                return;
        }
    }

    private async started(sessionId: string, handle: TAgentHandle): Promise<void> {
        if (this.sessionReported && sessionId === this.session) return;
        this.session = sessionId;
        this.sessionReported = true;
        const title = this.title ?? 'Untitled';
        this.title = null;
        await this.guard(this.deps.hooks.sessionStarted(sessionId, handle, title), 'recording the session');
    }

    private async finished(result: TStreamResult): Promise<void> {
        const tokens = tokensDto(result.usage);
        this.sessionTokens = addTokens(this.sessionTokens, tokens);
        const sessionId = result.sessionId ?? this.session;
        if (sessionId !== null) {
            try {
                const credits = await this.deps.hooks.turnFinished(sessionId, result);
                this.emit({ type: 'usage', credits, turnCredits: creditsOf(result.costUsd), tokens });
            } catch (e) {
                this.log(`charging ${this.deps.storyId} failed: ${errorMessage(e)}`);
            }
        }
        this.endTurn();
        if (this.stream) this.setStatus('ready');
    }

    private touch(files: readonly string[]): void {
        const added = files.filter((file) => !this.touched.includes(file));
        if (added.length === 0) return;
        this.touched = [...this.touched, ...added];
        this.emit({ type: 'activity', touchedFiles: [...this.touched] });
    }

    private endTurn(): void {
        this.turn = false;
        if (this.turnTimer) clearTimeout(this.turnTimer);
        this.turnTimer = null;
        this.clearFallbackTimer();
        if (this.touched.length === 0) return;
        this.touched = [];
        this.emit({ type: 'activity', touchedFiles: [] });
    }

    private armTurnTimer(): void {
        const { maxTurnMs } = this.deps;
        this.turnTimer = setTimeout(() => {
            this.turnTimer = null;
            this.say(`The turn took longer than ${minutes(maxTurnMs)} min and was interrupted`);
            void this.interrupt();
        }, maxTurnMs);
        this.turnTimer.unref();
    }

    private clearFallbackTimer(): void {
        if (this.fallbackTimer) clearTimeout(this.fallbackTimer);
        this.fallbackTimer = null;
    }

    private addMessage(message: TAiMessageDto): void {
        this.transcript.push(message);
        this.emit({ type: 'message', message });
    }

    private emit(event: TAiEvent): void {
        for (const listener of this.listeners) {
            try {
                listener(event);
            } catch (e) {
                this.log(`an AI event listener failed: ${errorMessage(e)}`);
            }
        }
    }

    private async guard(task: Promise<void>, what: string): Promise<void> {
        try {
            await task;
        } catch (e) {
            this.log(`${what} for ${this.deps.storyId} failed: ${errorMessage(e)}`);
        }
    }
}
