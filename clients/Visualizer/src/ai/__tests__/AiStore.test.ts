import '@story/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, createMockApi, type TMockApi } from '../../api';
import { settle } from '../../stores/__tests__/mockStores';
import { getUiState, removeUiState } from '../../ui-state';
import { AI_OPEN_KEY, AiStore } from '../AiStore';

describe('AiStore', () => {
    let api: TMockApi;
    let store: AiStore;
    let release: () => void;

    const create = (overrides: Partial<TMockApi> = {}, aiCredits = 10, aiStepMs = 0) => {
        api = { ...createMockApi({ aiCredits, aiStepMs }), ...overrides };
        store = new AiStore({ api });
        release = store.start();
    };

    const openReady = async () => {
        store.setOpen(true);
        await settle();
        await vi.waitFor(() => expect(store.status).toBe('ready'));
    };

    const texts = () => store.messages.map((m) => (m.kind === 'tool' ? m.summary : m.text));

    const lastText = () => texts()[texts().length - 1];

    beforeEach(async () => {
        removeUiState(AI_OPEN_KEY);
        create();
        await settle();
    });

    afterEach(() => release());

    it('loads the agent state, connects while open and persists the open state', async () => {
        expect(store.available).toBe(true);
        expect(store.enabled).toBe(true);
        expect(store.credits).toBe(10);
        expect(store.visible).toBe(false);

        const aiEvents = vi.spyOn(api, 'aiEvents');
        await openReady();
        expect(aiEvents).toHaveBeenCalledTimes(1);
        expect(store.visible).toBe(true);
        expect(getUiState(AI_OPEN_KEY, null)).toBe(true);
        expect(new AiStore({ api }).open).toBe(true);

        store.setOpen(false);
        expect(getUiState(AI_OPEN_KEY, null)).toBe(false);
        expect((await api.getAi()).status).toBe('stopped');
    });

    it('shows the sent message at once, without a duplicate when the server echoes it, then the reply', async () => {
        await openReady();
        store.setDraft('Please edit the start passage');
        const sending = store.send();
        expect(texts()).toEqual(['Please edit the start passage']);
        expect(store.draft).toBe('');
        expect(await sending).toBe(true);

        await vi.waitFor(() => expect(store.status).toBe('ready'));
        await settle();
        expect(texts()).toEqual([
            'Please edit the start passage',
            'Edited data/chapters/start/start.passages.ts',
            'You said:\nPlease edit the start passage',
        ]);
        expect(store.messages.every((m) => !m.id.startsWith('local-'))).toBe(true);
        expect(store.credits).toBe(9);
        expect(store.touchedFiles).toEqual([]);
        expect(store.sessionId).toBeNull();
        expect((await api.getAi()).sessionId).not.toBeNull();
    });

    it('keeps the sent message pending until the server echoes it, then shows only the echo', async () => {
        let resolve: () => void = () => {};
        release();
        create({
            sendAiMessage: async () => {
                await new Promise<void>((r) => (resolve = r));
                return { ok: true };
            },
        });
        await settle();
        store.applyEvent({ type: 'status', status: 'ready' });
        const sending = store.send('Hello');
        expect(store.messages).toHaveLength(1);
        expect(store.messages[0].id).toMatch(/^local-/);

        store.applyEvent({ type: 'message', message: { kind: 'user', id: 'srv-1', text: 'Hello', at: 'x' } });
        expect(store.messages.map((m) => m.id)).toEqual(['srv-1']);
        resolve();
        expect(await sending).toBe(true);
        expect(store.messages.map((m) => m.id)).toEqual(['srv-1']);
    });

    it('applies stream events: activity, status with a reason, usage and snapshots', () => {
        store.applyEvent({ type: 'status', status: 'busy' });
        expect(store.working).toBe(true);
        expect(store.locked).toBe(true);
        store.applyEvent({ type: 'activity', touchedFiles: ['data/a.ts', 'data/b.ts'] });
        expect(store.touchedFiles).toEqual(['data/a.ts', 'data/b.ts']);
        store.applyEvent({ type: 'activity', touchedFiles: [] });
        expect(store.touchedFiles).toEqual([]);
        store.applyEvent({
            type: 'usage',
            credits: 3,
            turnCredits: 2,
            tokens: { input: 1, output: 1, cacheRead: 0, cacheCreation: 0 },
        });
        expect(store.credits).toBe(3);
        store.applyEvent({ type: 'status', status: 'stopped', message: 'The story folder was replaced' });
        expect(store.statusMessage).toBe('The story folder was replaced');
        expect(store.working).toBe(false);

        store.applyEvent({
            type: 'snapshot',
            status: 'ready',
            credits: 0,
            sessionId: null,
            messages: [{ kind: 'system', id: 's1', text: 'hello', at: '2026-01-01T00:00:00Z' }],
            touchedFiles: [],
        });
        expect(texts()).toEqual(['hello']);
        expect(store.statusMessage).toBeNull();
        expect(store.noCredits).toBe(true);
    });

    it('handles the commands through the server', async () => {
        await openReady();
        await store.send('First prompt');
        await vi.waitFor(() => expect(store.status).toBe('ready'));
        await settle();

        await store.send('/help');
        await settle();
        expect(lastText()).toContain('/resume [n]');

        await store.send('/cost');
        await settle();
        expect(lastText()).toBe('Credits left: 9');

        await store.send('/clear');
        await settle();
        expect(store.messages).toEqual([]);
        expect(store.sessionId).toBeNull();

        await store.send('/resume');
        await settle();
        expect(lastText()).toMatch(/^1\. First prompt · /);

        await store.send('/resume 1');
        await settle();
        expect(texts()[0]).toBe('First prompt');
        expect(store.sessionId).not.toBeNull();

        await store.loadSessions();
        expect(store.sessions.map((s) => s.title)).toEqual(['First prompt']);
    });

    it('stops a running turn', async () => {
        release();
        create({}, 10, 300);
        await settle();
        await openReady();
        await store.send('Summarize the story');
        await vi.waitFor(() => expect(store.working).toBe(true));

        await store.interrupt();
        await vi.waitFor(() => expect(store.status).toBe('ready'));
        await new Promise((r) => setTimeout(r, 700));
        expect(texts()).toEqual(['Summarize the story', 'Interrupted']);
        expect(store.credits).toBe(10);
    });

    it('keeps the draft and sets lastError when the server refuses the message', async () => {
        const refuse = (status: number, error: 'ai_busy' | 'ai_no_credits' | 'too_many_requests', message?: string) =>
            create({ sendAiMessage: () => Promise.reject(new ApiError(status, { error, message })) });

        release();
        refuse(409, 'ai_busy');
        await settle();
        await openReady();
        expect(await store.send('Hello')).toBe(false);
        expect(store.messages).toEqual([]);
        expect(store.draft).toBe('Hello');
        expect(store.lastError).toMatch(/still working/);
        expect(store.noCredits).toBe(false);

        release();
        refuse(429, 'too_many_requests', 'Too many messages to the agent, try again in a minute');
        await settle();
        await openReady();
        expect(await store.send('Hello')).toBe(false);
        expect(store.draft).toBe('Hello');
        expect(store.lastError).toMatch(/Too many messages/);
        expect(store.canSend).toBe(true);

        release();
        refuse(402, 'ai_no_credits');
        await settle();
        await openReady();
        expect(await store.send('Hello')).toBe(false);
        expect(store.lastError).toMatch(/no AI credits/);
        expect(store.noCredits).toBe(true);
        expect(store.canSend).toBe(false);
    });

    it('locks the input without credits and does not call the server', async () => {
        release();
        create({}, 0);
        await settle();
        const send = vi.spyOn(api, 'sendAiMessage');
        store.setOpen(true);
        await settle();
        expect(store.status).toBe('no_credits');
        expect(store.noCredits).toBe(true);
        expect(await store.send('Hello')).toBe(false);
        expect(send).not.toHaveBeenCalled();
    });
});
