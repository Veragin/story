import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { TAiEvent } from '@story/protocol';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AiAgents, FOLDER_REPLACED, SERVER_SHUTDOWN, STORY_DELETED } from '../../src/ai/AiAgents';
import type { TAiOptions } from '../../src/ai/aiOptions';
import { AiCreditRepository } from '../../src/database/repositories/AiCreditRepository';
import { AiSessionRepository } from '../../src/database/repositories/AiSessionRepository';
import { StoryRepository } from '../../src/database/repositories/StoryRepository';
import { StoryLifecycle } from '../../src/stories/StoryLifecycle';
import { setupTestDatabase } from '../helpers/database';
import {
    editLine,
    FakeAgentConnection,
    initLine,
    resultLine,
    SESSION_ID,
    textLine,
} from '../helpers/FakeAgentConnection';
import { waitFor } from '../helpers/http';
import { storyFixture } from '../helpers/storiesRoot';

const dataSource = setupTestDatabase();

const OPTIONS: TAiOptions = {
    sandbox: 'launcher',
    launcherUrl: 'http://launcher.invalid',
    launcherKeyFile: '/nonexistent',
    sessionsDir: '',
    model: 'claude-sonnet-5-5',
    idleStopMs: 40,
    maxTurnMs: 60_000,
    maxBudgetUsd: 5,
    messagesPerMinute: 20,
    requireApiKey: false,
};

const oldSessionId = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

let sessionsDir: string;
let agents: AiAgents | undefined;

beforeEach(async () => {
    sessionsDir = await mkdtemp(path.join(tmpdir(), 'ai-sessions-'));
});

afterEach(async () => {
    await agents?.onApplicationShutdown();
    agents = undefined;
    await rm(sessionsDir, { recursive: true, force: true });
});

const setup = async ({ balance = 250, storyId = 'alpha' } = {}) => {
    await new StoryRepository(dataSource).insert(storyId, storyFixture());
    const credits = new AiCreditRepository(dataSource);
    if (balance > 0) await credits.topUp(storyId, balance);
    const sessions = new AiSessionRepository(dataSource);
    const connection = new FakeAgentConnection(sessionsDir);
    const lifecycle = new StoryLifecycle();
    agents = new AiAgents({ ...OPTIONS, sessionsDir }, connection, credits, sessions, lifecycle);
    agents.onModuleInit();
    await agents.onApplicationBootstrap();
    const viewer = (start = true) => {
        const events: TAiEvent[] = [];
        const detach = agents?.attach(storyId, (event) => events.push(event), { credits: balance, start });
        return { events, detach: detach ?? (() => undefined) };
    };
    return { agents, connection, credits, sessions, lifecycle, viewer, storyId };
};

const lastStatus = (events: TAiEvent[]) => events.filter((e) => e.type === 'status').at(-1);

describe('AiAgents', () => {
    it('boot: removes orphaned agents and clears stale running columns', async () => {
        await new StoryRepository(dataSource).insert('beta', storyFixture());
        const sessions = new AiSessionRepository(dataSource);
        await sessions.upsert('beta', SESSION_ID, 'Old');
        await sessions.setRunning(SESSION_ID, 77, 'story-ai-beta-x');
        const { connection } = await setup();
        expect(connection.cleanups).toBe(1);
        expect(await sessions.read('beta', SESSION_ID)).toMatchObject({ pid: null, containerName: null });
    });

    it('boot survives an unreachable launcher', async () => {
        const connection = new FakeAgentConnection(sessionsDir);
        connection.failCleanup = new Error('unreachable');
        const sessions = new AiSessionRepository(dataSource);
        const local = new AiAgents(
            { ...OPTIONS, sessionsDir },
            connection,
            new AiCreditRepository(dataSource),
            sessions,
            new StoryLifecycle()
        );
        await expect(local.onApplicationBootstrap()).resolves.toBeUndefined();
    });

    it('the first viewer starts the agent with min(balance, cap) as budget; a second one attaches', async () => {
        const { connection, viewer } = await setup({ balance: 250 });
        const first = viewer();
        expect(first.events[0]).toEqual({
            type: 'snapshot',
            status: 'stopped',
            credits: 250,
            sessionId: null,
            messages: [],
            touchedFiles: [],
        });
        await waitFor(() => connection.streams.length === 1);
        expect(connection.last().launch).toEqual({ storyId: 'alpha', maxBudgetUsd: 2.5, model: 'claude-sonnet-5-5' });
        expect((await readdir(sessionsDir)).includes('alpha')).toBe(true);

        await agents?.send('alpha', 'Hello');
        const second = viewer();
        expect(second.events[0]).toMatchObject({ type: 'snapshot', messages: [{ kind: 'user', text: 'Hello' }] });
        expect(connection.streams).toHaveLength(1);
    });

    it('caps the budget at AI_MAX_BUDGET_USD', async () => {
        const { connection, viewer } = await setup({ balance: 100_000 });
        viewer();
        await waitFor(() => connection.streams.length === 1);
        expect(connection.last().launch.maxBudgetUsd).toBe(5);
    });

    it('records the session, charges each result and clears the running columns on exit', async () => {
        const { connection, credits, sessions, viewer } = await setup({ balance: 250 });
        const { events } = viewer();
        await agents?.send('alpha', 'Rename the village to something much longer '.repeat(5));
        const stream = connection.last();
        stream.emit(initLine(), editLine('data/a.ts'));
        await waitFor(() => events.some((e) => e.type === 'activity'));
        const row = await sessions.read('alpha', SESSION_ID);
        expect(row).toMatchObject({ pid: stream.handle.pid, containerName: stream.handle.containerName });
        expect(row?.title).toHaveLength(120);

        stream.emit(textLine('Done'), resultLine(0.0734512));
        await waitFor(() => events.some((e) => e.type === 'usage'));
        expect(events.find((e) => e.type === 'usage')).toMatchObject({ credits: 242, turnCredits: 8 });
        expect(await credits.balance('alpha')).toBe(242);
        const usage: { credits: number; costMicroUsd: string | number }[] = await dataSource.query(
            'SELECT credits, costMicroUsd FROM story_ai_usage WHERE storyId = ?',
            ['alpha']
        );
        expect(usage.map((u) => [u.credits, Number(u.costMicroUsd)])).toEqual([[8, 73451]]);

        stream.exit(0);
        await waitFor(() => lastStatus(events)?.status === 'stopped');
        expect(await sessions.read('alpha', SESSION_ID)).toMatchObject({ pid: null, containerName: null });
    });

    it('prunes old sessions and deletes their transcripts', async () => {
        const { connection, sessions, viewer } = await setup();
        const transcripts = connection.layout('alpha').transcriptsDir;
        await mkdir(transcripts, { recursive: true });
        for (let n = 1; n <= 10; n++) {
            await sessions.upsert('alpha', oldSessionId(n), `Old ${n}`);
            await dataSource.query('UPDATE story_ai_session SET lastUsedAt = ? WHERE sessionId = ?', [
                `2026-01-01 00:00:${String(n).padStart(2, '0')}.000000`,
                oldSessionId(n),
            ]);
            await writeFile(path.join(transcripts, `${oldSessionId(n)}.jsonl`), '{}\n');
        }
        viewer();
        await agents?.send('alpha', 'New one');
        connection.last().emit(initLine());
        await waitFor(() => connection.last().sent.length === 1);
        for (let tries = 0; (await readdir(transcripts)).length !== 9; tries++) {
            if (tries > 100) throw new Error('the transcript was not pruned');
            await new Promise((resolve) => setTimeout(resolve, 20));
        }
        const left = (await sessions.listRecent('alpha')).map((s) => s.sessionId);
        expect(left).toHaveLength(10);
        expect(left).toContain(SESSION_ID);
        expect(left).not.toContain(oldSessionId(1));
        expect(await readdir(transcripts)).not.toContain(`${oldSessionId(1)}.jsonl`);
    });

    it('stops the agent after the last viewer has been gone for AI_IDLE_STOP_MS', async () => {
        const { connection, viewer } = await setup();
        const first = viewer();
        await waitFor(() => connection.streams.length === 1);
        first.detach();
        const second = viewer();
        await new Promise((resolve) => setTimeout(resolve, 80));
        expect(connection.last().closed).toBe(false);
        second.detach();
        await waitFor(() => connection.last().closed);
        expect(agents?.find('alpha')?.running).toBe(false);
    });

    it('a crash reports stopped; the next message restarts with --resume', async () => {
        const { connection, viewer } = await setup();
        const { events } = viewer();
        await agents?.send('alpha', 'one');
        connection.last().emit(initLine(), resultLine(0.01));
        await waitFor(() => events.some((e) => e.type === 'usage'));
        connection.last().exit(137, 'Killed');
        await waitFor(() => lastStatus(events)?.status === 'stopped');
        expect(lastStatus(events)).toMatchObject({ message: 'The agent exited with code 137: Killed' });
        await agents?.send('alpha', 'two');
        expect(connection.streams).toHaveLength(2);
        expect(connection.last().launch.resumeSessionId).toBe(SESSION_ID);
    });

    it('a folder swap stops the agent first; a story delete also removes its sessions folder', async () => {
        const { connection, lifecycle, viewer } = await setup();
        const { events } = viewer();
        await waitFor(() => connection.streams.length === 1);
        await lifecycle.beforeFolderSwap('alpha');
        expect(connection.last().closed).toBe(true);
        expect(lastStatus(events)).toEqual({ type: 'status', status: 'stopped', message: FOLDER_REPLACED });

        await agents?.send('alpha', 'after the swap');
        expect(connection.streams).toHaveLength(2);
        await lifecycle.beforeDelete('alpha');
        expect(connection.last().closed).toBe(true);
        expect(lastStatus(events)).toMatchObject({ message: STORY_DELETED });
        expect(await readdir(sessionsDir)).not.toContain('alpha');
        expect(agents?.find('alpha')).toBeUndefined();
    });

    it('shutdown stops every agent', async () => {
        const { connection, viewer } = await setup();
        const { events } = viewer();
        await waitFor(() => connection.streams.length === 1);
        await agents?.onApplicationShutdown();
        expect(connection.last().closed).toBe(true);
        expect(lastStatus(events)).toMatchObject({ status: 'stopped', message: SERVER_SHUTDOWN });
    });

    it('attaching without start does not spawn', async () => {
        const { connection, viewer } = await setup();
        viewer(false);
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(connection.streams).toHaveLength(0);
    });
});
