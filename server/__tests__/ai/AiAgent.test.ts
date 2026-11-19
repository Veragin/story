import type { TAiEvent } from '@story/protocol';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TAgentHandle } from '../../src/ai/agentConnection/TAgentConnection';
import { AiAgent, type TAiAgentHooks } from '../../src/ai/AiAgent';
import type { TStreamResult } from '../../src/ai/streamJson';
import {
    editLine,
    FakeAgentConnection,
    initLine,
    resultLine,
    SESSION_ID,
    textLine,
} from '../helpers/FakeAgentConnection';
import { waitFor } from '../helpers/http';

type TCalls = {
    started: { sessionId: string; handle: TAgentHandle; title: string }[];
    charged: { sessionId: string; result: TStreamResult }[];
    exited: (string | null)[];
};

const setup = ({ budget = 2, maxTurnMs = 60_000, interruptFallbackMs = 50 } = {}) => {
    const connection = new FakeAgentConnection('/sessions');
    const calls: TCalls = { started: [], charged: [], exited: [] };
    let balance = 500;
    const hooks: TAiAgentHooks = {
        prepareLaunch: () => Promise.resolve(budget),
        sessionStarted: async (sessionId, handle, title) => {
            await Promise.resolve();
            calls.started.push({ sessionId, handle, title });
        },
        turnFinished: async (sessionId, result) => {
            await Promise.resolve();
            calls.charged.push({ sessionId, result });
            balance -= 8;
            return balance;
        },
        processExited: async (sessionId) => {
            await Promise.resolve();
            calls.exited.push(sessionId);
        },
    };
    const agent = new AiAgent({
        storyId: 'alpha',
        connection,
        hooks,
        model: 'claude-sonnet-5-5',
        maxTurnMs,
        interruptFallbackMs,
    });
    const events: TAiEvent[] = [];
    agent.subscribe((event) => events.push(event));
    return { agent, connection, calls, events };
};

const statuses = (events: TAiEvent[]) => events.flatMap((e) => (e.type === 'status' ? [e.status] : []));

afterEach(() => {
    vi.useRealTimers();
});

describe('AiAgent', () => {
    it('starts, runs a turn, collects touched files and charges the result', async () => {
        const { agent, connection, calls, events } = setup();
        expect(await agent.send('Rename the village')).toBe('sent');
        const stream = connection.last();
        expect(stream.launch).toEqual({ storyId: 'alpha', maxBudgetUsd: 2, model: 'claude-sonnet-5-5' });
        expect(stream.userMessages).toEqual(['Rename the village']);
        expect(agent.busy).toBe(true);
        expect(await agent.send('again')).toBe('busy');

        stream.emit(initLine(), editLine('data/a.ts'), editLine('data/b.ts'), editLine('data/a.ts', 'second'));
        await waitFor(() => events.filter((e) => e.type === 'activity').length === 2);
        expect(calls.started).toEqual([{ sessionId: SESSION_ID, handle: stream.handle, title: 'Rename the village' }]);
        expect(agent.sessionId).toBe(SESSION_ID);

        stream.emit(textLine('Done'), resultLine(0.0734));
        await waitFor(() => !agent.busy);
        expect(calls.charged).toHaveLength(1);
        expect(statuses(events)).toEqual(['starting', 'ready', 'busy', 'ready']);
        const activities = events.flatMap((e) => (e.type === 'activity' ? [e.touchedFiles] : []));
        expect(activities).toEqual([['data/a.ts'], ['data/a.ts', 'data/b.ts'], []]);
        expect(events.find((e) => e.type === 'usage')).toEqual({
            type: 'usage',
            credits: 492,
            turnCredits: 8,
            tokens: { input: 10, output: 20, cacheRead: 30, cacheCreation: 40 },
        });
        expect(agent.messages.map((m) => m.kind)).toEqual(['user', 'assistant']);
        expect(agent.tokens).toEqual({ input: 10, output: 20, cacheRead: 30, cacheCreation: 40 });
        expect(agent.snapshot(492)).toMatchObject({ status: 'ready', sessionId: SESSION_ID, touchedFiles: [] });
    });

    it('a crash ends the turn and reports the stderr tail; the next message resumes the session', async () => {
        const { agent, connection, calls, events } = setup();
        await agent.send('first');
        connection.last().emit(initLine(), editLine('data/a.ts'));
        await waitFor(() => calls.started.length === 1);
        connection.last().exit(1, 'boom: out of memory\n');
        await waitFor(() => agent.status === 'stopped');
        expect(events.at(-1)).toEqual({
            type: 'status',
            status: 'stopped',
            message: 'The agent exited with code 1: boom: out of memory',
        });
        expect(events.filter((e) => e.type === 'activity').at(-1)).toEqual({ type: 'activity', touchedFiles: [] });
        expect(calls.exited).toEqual([SESSION_ID]);
        expect(agent.busy).toBe(false);

        expect(await agent.send('second')).toBe('sent');
        expect(connection.streams).toHaveLength(2);
        expect(connection.last().launch.resumeSessionId).toBe(SESSION_ID);
        connection.last().emit(initLine());
        await waitFor(() => calls.started.length === 2);
        expect(calls.started[1].title).toBe('Untitled');
    });

    it('stop() closes the stream and reports the given reason', async () => {
        const { agent, connection, events } = setup();
        await agent.start();
        await agent.stop('The story folder was replaced');
        expect(connection.last().closed).toBe(true);
        expect(agent.running).toBe(false);
        expect(events.at(-1)).toEqual({ type: 'status', status: 'stopped', message: 'The story folder was replaced' });
    });

    it('no budget: does not spawn and says so', async () => {
        const { agent, connection, events } = setup({ budget: 0 });
        expect(await agent.send('hi')).toBe('failed');
        expect(connection.launches).toHaveLength(0);
        expect(events.at(-1)).toMatchObject({ type: 'status', status: 'no_credits' });
        expect(agent.busy).toBe(false);
    });

    it('a failed spawn reports an error', async () => {
        const { agent, connection, events } = setup();
        connection.failOpen = new Error('The AI launcher answered 503 token_unavailable');
        expect(await agent.start()).toBe(false);
        expect(events.at(-1)).toEqual({
            type: 'status',
            status: 'error',
            message: 'The agent could not start: The AI launcher answered 503 token_unavailable',
        });
    });

    it('interrupt sends a control request, then the launcher fallback while the turn still runs', async () => {
        const { agent, connection } = setup({ interruptFallbackMs: 30 });
        await agent.send('long task');
        const stream = connection.last();
        await agent.interrupt();
        expect(JSON.parse(stream.sent.at(-1) ?? '')).toEqual({
            type: 'control_request',
            request_id: 'interrupt-1',
            request: { subtype: 'interrupt' },
        });
        expect(stream.interrupts).toBe(0);
        await waitFor(() => stream.interrupts === 1);

        stream.emit(resultLine(0.01, SESSION_ID, { subtype: 'error_during_execution', is_error: true }));
        await waitFor(() => !agent.busy);
        await agent.send('next');
        await agent.interrupt();
        connection.last().emit(resultLine(0.01));
        await waitFor(() => !agent.busy);
        await new Promise((resolve) => setTimeout(resolve, 60));
        expect(stream.interrupts).toBe(1);
    });

    it('interrupts a turn that runs longer than maxTurnMs', async () => {
        const { agent, connection } = setup({ maxTurnMs: 40, interruptFallbackMs: 10_000 });
        await agent.send('slow');
        await waitFor(() => connection.last().sent.length === 2);
        expect(agent.messages.at(-1)).toMatchObject({ kind: 'system', text: expect.stringContaining('interrupted') });
    });

    it('reset and load replace the transcript', () => {
        const { agent } = setup();
        agent.say('hello');
        agent.load(SESSION_ID, [{ kind: 'user', id: '1', text: 'old', at: '2026-01-01T00:00:00.000Z' }]);
        expect(agent.snapshot(5)).toMatchObject({ sessionId: SESSION_ID, messages: [{ text: 'old' }], credits: 5 });
        agent.reset();
        expect(agent.snapshot(5)).toMatchObject({ sessionId: null, messages: [] });
    });
});
