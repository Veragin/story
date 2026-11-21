import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import {
    Inject,
    Injectable,
    Logger,
    type OnApplicationBootstrap,
    type OnApplicationShutdown,
    type OnModuleInit,
} from '@nestjs/common';
import { isAiSessionId, type TAiEvent, type TAiMessageDto, type TAiStatus } from '@story/protocol';
import { errorMessage } from '../common/HttpError';
import { AiCreditRepository } from '../database/repositories/AiCreditRepository';
import { AiSessionRepository } from '../database/repositories/AiSessionRepository';
import { StoryLifecycle } from '../stories/StoryLifecycle';
import { AGENT_CONNECTION, type TAgentConnection } from './agentConnection/TAgentConnection';
import { AiAgent, type TAiAgentHooks, type TSendOutcome } from './AiAgent';
import { AI_OPTIONS, type TAiOptions } from './aiOptions';
import { usageRecord, usdOfCredits } from './usage';

export const FOLDER_REPLACED = 'The story folder was replaced';
export const STORY_DELETED = 'The story was deleted';
export const SERVER_SHUTDOWN = 'The server is shutting down';

type TEntry = { agent: AiAgent; viewers: number; idleTimer: NodeJS.Timeout | null };

// `blockedStatus`: the snapshot's status while no process runs (no credits)
export type TAttachOptions = { credits: number; start: boolean; blockedStatus?: TAiStatus };

@Injectable()
export class AiAgents implements OnModuleInit, OnApplicationBootstrap, OnApplicationShutdown {
    private readonly logger = new Logger('Ai');
    private readonly entries = new Map<string, TEntry>();
    private closed = false;

    constructor(
        @Inject(AI_OPTIONS) private readonly options: TAiOptions,
        @Inject(AGENT_CONNECTION) private readonly connection: TAgentConnection,
        private readonly credits: AiCreditRepository,
        private readonly sessions: AiSessionRepository,
        private readonly lifecycle: StoryLifecycle
    ) {}

    onModuleInit(): void {
        this.lifecycle.onBeforeFolderSwap((storyId) => this.stop(storyId, FOLDER_REPLACED));
        this.lifecycle.onBeforeDelete((storyId) => this.forget(storyId));
    }

    // agents of an earlier server run have no stream any more
    async onApplicationBootstrap(): Promise<void> {
        try {
            const removed = await this.connection.cleanupAll();
            if (removed > 0) this.logger.log(`Removed ${removed} orphaned AI agent(s)`);
        } catch (e) {
            this.logger.warn(`Could not remove orphaned AI agents: ${errorMessage(e)}`);
        }
        await this.sessions.clearAllRunning();
    }

    async onApplicationShutdown(): Promise<void> {
        this.closed = true;
        for (const entry of this.entries.values()) this.cancelIdle(entry);
        await Promise.all([...this.entries.keys()].map((storyId) => this.stop(storyId, SERVER_SHUTDOWN)));
    }

    agent(storyId: string): AiAgent {
        return this.entry(storyId).agent;
    }

    find(storyId: string): AiAgent | undefined {
        return this.entries.get(storyId)?.agent;
    }

    viewers(storyId: string): number {
        return this.entries.get(storyId)?.viewers ?? 0;
    }

    // the listener gets a snapshot first; returns the detach function
    attach(
        storyId: string,
        listener: (event: TAiEvent) => void,
        { credits, start, blockedStatus }: TAttachOptions
    ): () => void {
        const entry = this.entry(storyId);
        entry.viewers++;
        this.cancelIdle(entry);
        listener(entry.agent.snapshot(credits, entry.agent.running ? undefined : blockedStatus));
        const unsubscribe = entry.agent.subscribe(listener);
        if (start && !entry.agent.running && !this.closed) void entry.agent.start();
        let detached = false;
        return () => {
            if (detached) return;
            detached = true;
            unsubscribe();
            entry.viewers--;
            if (entry.viewers === 0) this.scheduleIdleStop(storyId, entry);
        };
    }

    // a listener of a story whose agent may not start (disabled, unavailable); returns the unsubscribe
    subscribe(storyId: string, listener: (event: TAiEvent) => void): () => void {
        return this.entry(storyId).agent.subscribe(listener);
    }

    // to every open stream of the story
    publish(storyId: string, event: TAiEvent): void {
        this.find(storyId)?.publish(event);
    }

    send(storyId: string, text: string): Promise<TSendOutcome> {
        return this.entry(storyId).agent.send(text);
    }

    async interrupt(storyId: string): Promise<void> {
        await this.find(storyId)?.interrupt();
    }

    async stop(storyId: string, message: string | null = null): Promise<void> {
        await this.find(storyId)?.stop(message);
    }

    async clear(storyId: string, credits: number): Promise<void> {
        const { agent } = this.entry(storyId);
        await agent.stop();
        agent.reset();
        agent.broadcastSnapshot(credits);
        await agent.start();
    }

    async resume(storyId: string, sessionId: string, messages: TAiMessageDto[], credits: number): Promise<void> {
        const { agent } = this.entry(storyId);
        await agent.stop();
        agent.load(sessionId, messages);
        agent.broadcastSnapshot(credits);
        await agent.start();
    }

    private async forget(storyId: string): Promise<void> {
        const entry = this.entries.get(storyId);
        if (entry) {
            this.cancelIdle(entry);
            await entry.agent.stop(STORY_DELETED);
            this.entries.delete(storyId);
        }
        await rm(this.connection.layout(storyId).sessionsRoot, { recursive: true, force: true });
    }

    private entry(storyId: string): TEntry {
        const existing = this.entries.get(storyId);
        if (existing) return existing;
        const agent = new AiAgent({
            storyId,
            connection: this.connection,
            hooks: this.hooks(storyId),
            model: this.options.model,
            maxTurnMs: this.options.maxTurnMs,
            log: (message) => this.logger.warn(message),
        });
        const entry: TEntry = { agent, viewers: 0, idleTimer: null };
        this.entries.set(storyId, entry);
        return entry;
    }

    private hooks(storyId: string): TAiAgentHooks {
        return {
            prepareLaunch: async () => {
                const balance = await this.credits.balance(storyId);
                await mkdir(this.connection.layout(storyId).sessionsRoot, { recursive: true });
                return Math.min(usdOfCredits(balance), this.options.maxBudgetUsd);
            },
            sessionStarted: async (sessionId, { pid, containerName }, title) => {
                await this.sessions.upsert(storyId, sessionId, title);
                await this.sessions.setRunning(sessionId, pid, containerName);
                await this.removeTranscripts(storyId, await this.sessions.prune(storyId));
            },
            turnFinished: async (sessionId, result) => {
                const balance = await this.credits.charge(storyId, usageRecord(result, sessionId, this.options.model));
                await this.sessions.touch(sessionId);
                return balance;
            },
            processExited: async (sessionId) => {
                if (sessionId !== null) await this.sessions.clearRunning(sessionId);
            },
        };
    }

    private async removeTranscripts(storyId: string, sessionIds: readonly string[]): Promise<void> {
        const { transcriptsDir } = this.connection.layout(storyId);
        for (const sessionId of sessionIds.filter(isAiSessionId)) {
            await rm(path.join(transcriptsDir, `${sessionId}.jsonl`), { force: true });
            await rm(path.join(transcriptsDir, sessionId), { recursive: true, force: true });
        }
    }

    private scheduleIdleStop(storyId: string, entry: TEntry): void {
        this.cancelIdle(entry);
        if (this.closed) return;
        entry.idleTimer = setTimeout(() => {
            entry.idleTimer = null;
            if (entry.viewers === 0) void this.stop(storyId);
        }, this.options.idleStopMs);
        entry.idleTimer.unref();
    }

    private cancelIdle(entry: TEntry): void {
        if (entry.idleTimer) clearTimeout(entry.idleTimer);
        entry.idleTimer = null;
    }
}
