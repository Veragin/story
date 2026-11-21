import { readFile } from 'node:fs/promises';
import type { ServerResponse } from 'node:http';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
    AI_MESSAGE_MAX_LENGTH,
    isAiSessionId,
    type TAiDto,
    type TAiMessageDto,
    type TAiSessionDto,
    type TAiStatus,
    type TOkDto,
} from '@story/protocol';
import type { LoginLimiter } from '../auth/LoginLimiter';
import type { TStoryGrant } from '../auth/storyGrant';
import { jsonObjectBody } from '../common/body';
import { rejectUnknownFields, textField } from '../common/fields';
import { HttpError } from '../common/HttpError';
import { AiCreditRepository } from '../database/repositories/AiCreditRepository';
import { AiSessionRepository, type TAiSessionRecord } from '../database/repositories/AiSessionRepository';
import { StoryRepository } from '../database/repositories/StoryRepository';
import { AGENT_CONNECTION, type TAgentConnection } from './agentConnection/TAgentConnection';
import type { AiAgent } from './AiAgent';
import { AiAgents } from './AiAgents';
import { AiAvailability } from './AiAvailability';
import { helpText, parseAiCommand } from './aiCommands';
import { AI_MESSAGE_LIMITER } from './aiMessageLimiter';
import { streamAiEvents } from './aiEventStream';
import { transcriptMessages } from './streamJson';

type TBlock = { status: Extract<TAiStatus, 'disabled' | 'unavailable' | 'no_credits'>; message: string };

type TAiState = { enabled: boolean; available: boolean; credits: number; block: TBlock | null };

const OK: TOkDto = { ok: true };

export const DISABLED_MESSAGE = 'The AI agent is not enabled for this story';
const UNAVAILABLE_MESSAGE = 'The server cannot run AI agents right now';
export const NO_CREDITS_MESSAGE = 'The story has no AI credits left';

const BLOCK_ERRORS = {
    disabled: 'ai_disabled',
    unavailable: 'ai_unavailable',
    no_credits: 'ai_no_credits',
} as const;

const sessionDto = ({ sessionId, title, createdAt, lastUsedAt }: TAiSessionRecord): TAiSessionDto => ({
    sessionId,
    title,
    createdAt: createdAt.toISOString(),
    lastUsedAt: lastUsedAt.toISOString(),
});

const shortDate = (date: Date) => `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`;

const sessionList = (sessions: readonly TAiSessionRecord[]): string =>
    sessions.length === 0
        ? 'There are no earlier conversations'
        : [
              'Recent conversations (continue one with /resume <n>):',
              ...sessions.map((session, i) => `${i + 1}. ${session.title} · ${shortDate(session.lastUsedAt)}`),
          ].join('\n');

const isMissingFile = (e: unknown) => e instanceof Error && 'code' in e && e.code === 'ENOENT';

@Injectable()
export class AiService {
    constructor(
        private readonly stories: StoryRepository,
        private readonly credits: AiCreditRepository,
        private readonly sessions: AiSessionRepository,
        private readonly availability: AiAvailability,
        private readonly agents: AiAgents,
        @Inject(AGENT_CONNECTION) private readonly connection: TAgentConnection,
        @Inject(AI_MESSAGE_LIMITER) private readonly messageLimiter: LoginLimiter
    ) {}

    async getAi(storyId: string): Promise<TAiDto> {
        const { enabled, available, credits, block } = await this.state(storyId);
        const agent = this.agents.find(storyId);
        const running = agent?.running ?? false;
        return {
            available,
            imageGeneration: this.availability.imageGeneration,
            enabled,
            credits,
            status: block && !running ? block.status : (agent?.status ?? 'stopped'),
            sessionId: agent?.sessionId ?? null,
        };
    }

    async events(storyId: string, res: ServerResponse, grant: TStoryGrant | undefined): Promise<void> {
        const { credits, block } = await this.state(storyId);
        streamAiEvents(res, grant, (sink) => {
            if (block && block.status !== 'no_credits') {
                sink({
                    type: 'snapshot',
                    status: block.status,
                    credits,
                    sessionId: null,
                    messages: [],
                    touchedFiles: [],
                });
                sink({ type: 'status', status: block.status, message: block.message });
                return this.agents.subscribe(storyId, sink);
            }
            const blockedStatus = block?.status;
            const detach = this.agents.attach(storyId, sink, { credits, start: block === null, blockedStatus });
            if (block && !this.agents.agent(storyId).running)
                sink({ type: 'status', status: block.status, message: block.message });
            return detach;
        });
    }

    async send(storyId: string, body: unknown): Promise<TOkDto> {
        const fields = jsonObjectBody(body);
        rejectUnknownFields(fields, ['text']);
        const text = textField(fields, 'text', AI_MESSAGE_MAX_LENGTH, { required: true });
        const credits = await this.requireUsable(storyId);
        this.countMessage(storyId);
        const command = parseAiCommand(text);
        const agent = this.agents.agent(storyId);
        switch (command.kind) {
            case 'prompt':
                return await this.prompt(storyId, command.text);
            case 'help':
                agent.say(helpText());
                return OK;
            case 'cost': {
                const { input, output, cacheRead, cacheCreation } = agent.tokens;
                agent.say(
                    `Credits left: ${credits}. This conversation used ${input} input, ${output} output, ` +
                        `${cacheRead} cache-read and ${cacheCreation} cache-write tokens`
                );
                return OK;
            }
            case 'resume':
                if (command.index === null) {
                    agent.say(sessionList(await this.sessions.listRecent(storyId)));
                    return OK;
                }
                return await this.resumeAt(storyId, command.index, credits);
            case 'clear':
                return await this.clear(storyId);
            case 'invalid':
                throw HttpError.badRequest(command.message);
        }
    }

    async interrupt(storyId: string): Promise<TOkDto> {
        await this.requireEnabled(storyId);
        await this.agents.interrupt(storyId);
        return OK;
    }

    async listSessions(storyId: string): Promise<TAiSessionDto[]> {
        await this.requireEnabled(storyId);
        return (await this.sessions.listRecent(storyId)).map(sessionDto);
    }

    async resume(storyId: string, body: unknown): Promise<TOkDto> {
        const fields = jsonObjectBody(body);
        rejectUnknownFields(fields, ['sessionId']);
        const sessionId = fields.sessionId;
        if (!isAiSessionId(sessionId)) throw HttpError.badRequest('Field "sessionId" must be a session id');
        const credits = await this.requireUsable(storyId);
        if (!(await this.sessions.read(storyId, sessionId))) {
            throw HttpError.notFound(`No conversation "${sessionId}" in this story`);
        }
        return await this.resumeSession(storyId, sessionId, credits);
    }

    async clear(storyId: string): Promise<TOkDto> {
        const credits = await this.requireUsable(storyId);
        this.requireIdle(this.agents.agent(storyId));
        await this.agents.clear(storyId, credits);
        return OK;
    }

    private async prompt(storyId: string, text: string): Promise<TOkDto> {
        const outcome = await this.agents.send(storyId, text);
        if (outcome === 'busy') throw this.busy();
        if (outcome === 'failed') throw HttpError.of('ai_unavailable', 'The agent could not start');
        return OK;
    }

    private async resumeAt(storyId: string, index: number, credits: number): Promise<TOkDto> {
        const session = (await this.sessions.listRecent(storyId))[index - 1];
        if (!session) throw HttpError.badRequest(`There is no conversation ${index}: see /resume`);
        return await this.resumeSession(storyId, session.sessionId, credits);
    }

    private async resumeSession(storyId: string, sessionId: string, credits: number): Promise<TOkDto> {
        this.requireIdle(this.agents.agent(storyId));
        const messages = await this.replay(storyId, sessionId);
        await this.agents.resume(storyId, sessionId, messages, credits);
        return OK;
    }

    private async replay(storyId: string, sessionId: string): Promise<TAiMessageDto[]> {
        const { storyRoot, transcriptsDir } = this.connection.layout(storyId);
        try {
            const jsonl = await readFile(path.join(transcriptsDir, `${sessionId}.jsonl`), 'utf8');
            return transcriptMessages(jsonl, storyRoot, randomUUID);
        } catch (e) {
            if (isMissingFile(e)) return [];
            throw e;
        }
    }

    private countMessage(storyId: string): void {
        if (this.messageLimiter.isBlocked(storyId)) {
            throw HttpError.tooManyRequests('Too many messages to the agent, try again in a minute');
        }
        this.messageLimiter.fail(storyId);
    }

    private requireIdle(agent: AiAgent): void {
        if (agent.busy) throw this.busy();
    }

    private busy(): HttpError {
        return HttpError.of('ai_busy', 'The agent is still working on the previous message');
    }

    private async requireEnabled(storyId: string): Promise<void> {
        if (!(await this.stories.aiFeature(storyId))) throw HttpError.of('ai_disabled', DISABLED_MESSAGE);
    }

    // returns the balance
    private async requireUsable(storyId: string): Promise<number> {
        const { credits, block } = await this.state(storyId);
        if (block) throw HttpError.of(BLOCK_ERRORS[block.status], block.message);
        return credits;
    }

    private async state(storyId: string): Promise<TAiState> {
        const enabled = await this.stories.aiFeature(storyId);
        const { available } = this.availability;
        const credits = await this.credits.balance(storyId);
        return { enabled, available, credits, block: this.blockOf(enabled, available, credits) };
    }

    private blockOf(enabled: boolean, available: boolean, credits: number): TBlock | null {
        if (!enabled) return { status: 'disabled', message: DISABLED_MESSAGE };
        if (!available) return { status: 'unavailable', message: UNAVAILABLE_MESSAGE };
        if (credits <= 0) return { status: 'no_credits', message: NO_CREDITS_MESSAGE };
        return null;
    }
}
