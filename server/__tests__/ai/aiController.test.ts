import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { AI_MESSAGE_MAX_LENGTH, AI_SSE_EVENT, type TAiEvent } from '@story/protocol';
import { afterEach, describe, expect, it } from 'vitest';
import { FOLDER_REPLACED } from '../../src/ai/AiAgents';
import { AiCreditRepository } from '../../src/database/repositories/AiCreditRepository';
import { AiSessionRepository } from '../../src/database/repositories/AiSessionRepository';
import { StoryFolders } from '../../src/stories/StoryFolders';
import { FakeAgentConnection, initLine, resultLine, SESSION_ID } from '../helpers/FakeAgentConnection';
import { login, requestJson, waitFor, type TAny } from '../helpers/http';
import { openEventStream } from '../helpers/sse';
import { createTestApp, type TTestApp } from '../helpers/testApp';

let app: TTestApp | undefined;
let sessionsDir: string | undefined;
const streams: { close: () => void }[] = [];

afterEach(async () => {
    for (const stream of streams.splice(0)) stream.close();
    await app?.close();
    app = undefined;
    if (sessionsDir) await rm(sessionsDir, { recursive: true, force: true });
    sessionsDir = undefined;
});

const start = async ({
    enabled = true,
    credits = 300,
    available = true,
    images = true,
    messagesPerMinute = 20,
} = {}) => {
    sessionsDir = await mkdtemp(path.join(tmpdir(), 'ai-ctrl-sessions-'));
    const connection = new FakeAgentConnection(sessionsDir);
    if (!available) connection.healthResult = { available: false, reason: 'no launcher' };
    connection.imageGeneration = images;
    app = await createTestApp({
        stories: ['alpha'],
        agentConnection: connection,
        ai: { sessionsDir, messagesPerMinute },
    });
    if (enabled) await app.stories.setAiFeature('alpha', true);
    if (credits > 0) await app.app.get(AiCreditRepository).topUp('alpha', credits);
    const cookie = await login(app.base, 'alpha');
    const storyBase = `${app.base}/api/stories/alpha`;
    const call = (method: string, sub: string, body?: unknown) =>
        requestJson(`${storyBase}/ai${sub}`, method, { body, headers: { cookie } });
    const events = async () => {
        const stream = await openEventStream(`${storyBase}/ai/events`, { cookie });
        streams.push(stream);
        const ai = () => stream.frames.filter((f) => f.event === AI_SSE_EVENT).map((f): TAny => f.data);
        return { ...stream, ai };
    };
    return { testApp: app, connection, call, events };
};

const ofType = (events: TAiEvent[], type: TAiEvent['type']) => events.filter((e) => e.type === type);

describe('AI routes', () => {
    it('a story without the feature: 403 and a disabled status', async () => {
        const { call, events, connection } = await start({ enabled: false, credits: 0 });
        expect((await call('GET', '')).body).toEqual({
            available: true,
            imageGeneration: true,
            enabled: false,
            credits: 0,
            status: 'disabled',
            sessionId: null,
        });
        const sent = await call('POST', '/messages', { text: 'hi' });
        expect([sent.status, sent.body.error]).toEqual([403, 'ai_disabled']);
        expect((await call('POST', '/interrupt')).status).toBe(403);
        expect((await call('GET', '/sessions')).status).toBe(403);
        const stream = await events();
        await waitFor(() => stream.ai().length === 2);
        expect(stream.ai()).toEqual([
            { type: 'snapshot', status: 'disabled', credits: 0, sessionId: null, messages: [], touchedFiles: [] },
            { type: 'status', status: 'disabled', message: 'The AI agent is not enabled for this story' },
        ]);
        expect(connection.launches).toEqual([]);
    });

    it('no launcher: 503 ai_unavailable', async () => {
        const { call } = await start({ available: false, images: false });
        expect((await call('GET', '')).body).toMatchObject({
            available: false,
            imageGeneration: false,
            enabled: true,
            status: 'unavailable',
        });
        const sent = await call('POST', '/messages', { text: 'hi' });
        expect([sent.status, sent.body.error]).toEqual([503, 'ai_unavailable']);
    });

    it('no credits: 402 and no agent', async () => {
        const { call, events, connection } = await start({ credits: 0 });
        const sent = await call('POST', '/messages', { text: 'hi' });
        expect([sent.status, sent.body.error]).toEqual([402, 'ai_no_credits']);
        const stream = await events();
        await waitFor(() => stream.ai().length === 2);
        expect(stream.ai()[0]).toMatchObject({ type: 'snapshot', status: 'no_credits' });
        expect(stream.ai()[1]).toMatchObject({ type: 'status', status: 'no_credits' });
        expect(connection.launches).toEqual([]);
    });

    it('validates the message and resume bodies', async () => {
        const { call } = await start();
        for (const body of [{}, { text: '' }, { text: '  ' }, { text: 3 }, { text: 'hi', extra: 1 }, [], undefined]) {
            expect((await call('POST', '/messages', body)).status).toBe(400);
        }
        const long = await call('POST', '/messages', { text: 'x'.repeat(AI_MESSAGE_MAX_LENGTH + 1) });
        expect(long.status).toBe(400);
        expect((await call('POST', '/resume', { sessionId: '../../etc/passwd' })).status).toBe(400);
        const unknown = await call('POST', '/resume', { sessionId: SESSION_ID });
        expect([unknown.status, unknown.body.error]).toEqual([404, 'not_found']);
        expect((await call('POST', '/messages', { text: '/resume 0' })).status).toBe(400);
        expect((await call('POST', '/messages', { text: '/resume 4' })).status).toBe(400);
    });

    it('opening the events starts the agent; a turn is guarded, streamed and charged', async () => {
        const { testApp, call, events, connection } = await start({ credits: 300 });
        const stream = await events();
        expect(stream.ai()[0]).toEqual({
            type: 'snapshot',
            status: 'stopped',
            credits: 300,
            sessionId: null,
            messages: [],
            touchedFiles: [],
        });
        await waitFor(() => connection.streams.length === 1);
        expect(connection.last().launch).toEqual({ storyId: 'alpha', maxBudgetUsd: 3, model: 'claude-sonnet-5-5' });

        expect((await call('POST', '/messages', { text: 'Rename the village' })).body).toEqual({ ok: true });
        expect(connection.last().userMessages).toEqual(['Rename the village']);
        const busy = await call('POST', '/messages', { text: 'more' });
        expect([busy.status, busy.body.error]).toEqual([409, 'ai_busy']);
        expect((await call('POST', '/clear')).status).toBe(409);
        expect((await call('GET', '')).body).toMatchObject({ status: 'busy' });

        expect((await call('POST', '/interrupt')).body).toEqual({ ok: true });
        expect(JSON.parse(connection.last().sent.at(-1) ?? '')).toMatchObject({ type: 'control_request' });

        connection.last().emit(initLine(), resultLine(0.0734));
        await waitFor(() => ofType(stream.ai(), 'usage').length === 1);
        expect(ofType(stream.ai(), 'usage')[0]).toMatchObject({ credits: 292, turnCredits: 8 });
        expect(await testApp.app.get(AiCreditRepository).balance('alpha')).toBe(292);
        expect((await call('GET', '')).body).toEqual({
            available: true,
            imageGeneration: true,
            enabled: true,
            credits: 292,
            status: 'ready',
            sessionId: SESSION_ID,
        });
        expect((await call('GET', '/sessions')).body).toEqual([
            {
                sessionId: SESSION_ID,
                title: 'Rename the village',
                createdAt: expect.any(String),
                lastUsedAt: expect.any(String),
            },
        ]);

        const second = await events();
        expect(second.ai()[0]).toMatchObject({ type: 'snapshot', sessionId: SESSION_ID, status: 'ready' });
        expect(second.ai()[0].messages[0]).toMatchObject({ kind: 'user', text: 'Rename the village' });
        expect(connection.streams).toHaveLength(1);
    });

    it('answers /help, /cost and /resume with system messages', async () => {
        const { call, events, testApp } = await start({ credits: 300 });
        const stream = await events();
        const sessions = testApp.app.get(AiSessionRepository);
        await sessions.upsert('alpha', SESSION_ID, 'Old chat');
        for (const text of ['/help', '/cost', '/resume']) {
            expect((await call('POST', '/messages', { text })).status).toBe(200);
        }
        await waitFor(() => ofType(stream.ai(), 'message').length === 3);
        const texts = ofType(stream.ai(), 'message').map((e: TAny) => e.message.text);
        expect(texts[0]).toContain('/clear');
        expect(texts[1]).toMatch(/^Credits left: 300\. This conversation used 0 input/);
        expect(texts[2]).toMatch(/^Recent conversations.*\n1\. Old chat · \d{4}-\d\d-\d\d \d\d:\d\d UTC$/s);
    });

    it('answers 429 once a story sends more messages per minute than allowed', async () => {
        const { call } = await start({ messagesPerMinute: 2 });
        expect((await call('POST', '/messages', { text: '' })).status).toBe(400);
        for (const text of ['/help', '/cost']) expect((await call('POST', '/messages', { text })).status).toBe(200);
        const limited = await call('POST', '/messages', { text: '/help' });
        expect([limited.status, limited.body.error]).toEqual([429, 'too_many_requests']);
    });

    it('/resume <n> replays the transcript and restarts with --resume; /clear starts fresh', async () => {
        const { call, events, connection, testApp } = await start({ credits: 300 });
        const stream = await events();
        await waitFor(() => connection.streams.length === 1);
        await testApp.app.get(AiSessionRepository).upsert('alpha', SESSION_ID, 'Old chat');
        const transcripts = connection.layout('alpha').transcriptsDir;
        await mkdir(transcripts, { recursive: true });
        await writeFile(
            path.join(transcripts, `${SESSION_ID}.jsonl`),
            `${JSON.stringify({ type: 'user', uuid: 'u1', timestamp: '2026-11-01T00:00:00.000Z', message: { role: 'user', content: 'Earlier question' } })}\n`
        );

        expect((await call('POST', '/messages', { text: '/resume 1' })).body).toEqual({ ok: true });
        expect(connection.streams[0].closed).toBe(true);
        expect(connection.streams).toHaveLength(2);
        expect(connection.last().launch.resumeSessionId).toBe(SESSION_ID);
        const resumed = ofType(stream.ai(), 'snapshot').at(-1);
        expect(resumed).toMatchObject({
            sessionId: SESSION_ID,
            messages: [{ kind: 'user', id: 'u1', text: 'Earlier question', at: '2026-11-01T00:00:00.000Z' }],
        });

        expect((await call('POST', '/clear')).body).toEqual({ ok: true });
        expect(connection.streams).toHaveLength(3);
        expect(connection.last().launch.resumeSessionId).toBeUndefined();
        expect(ofType(stream.ai(), 'snapshot').at(-1)).toMatchObject({ sessionId: null, messages: [] });

        expect((await call('POST', '/resume', { sessionId: SESSION_ID })).body).toEqual({ ok: true });
        expect(connection.last().launch.resumeSessionId).toBe(SESSION_ID);
    });

    it('a folder swap through StoryFolders.replace stops the running agent first', async () => {
        const { events, connection, testApp } = await start();
        const stream = await events();
        await waitFor(() => connection.streams.length === 1);
        const folders = testApp.app.get(StoryFolders);
        const tmp = await folders.makeTemp('test-swap');
        await cp(folders.dir('alpha'), tmp, { recursive: true });
        await folders.replace('alpha', tmp);
        expect(connection.last().closed).toBe(true);
        expect(ofType(stream.ai(), 'status').at(-1)).toEqual({
            type: 'status',
            status: 'stopped',
            message: FOLDER_REPLACED,
        });
    });
});
