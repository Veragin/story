import { describe, expect, it, vi } from 'vitest';
import type { TChangeEvent } from '@story/visualizer-protocol';
import { ApiError } from '../ApiError';
import { ApiEvents, matchesFilter } from '../events';
import { createHttpApi } from '../httpApi';
import { createMockApi, extractEdges } from '../mockApi';

const ev = (e: Partial<TChangeEvent>): TChangeEvent => ({ kind: 'passage', id: 'a-b-c', version: 'v1', ...e });

describe('matchesFilter', () => {
    it('matches by kind, id, wildcard and chapter scope', () => {
        expect(matchesFilter({ kind: '*' }, ev({}))).toBe(true);
        expect(matchesFilter({ kind: 'chapter' }, ev({}))).toBe(false);
        expect(matchesFilter({ kind: 'passage', id: 'a-b-c' }, ev({}))).toBe(true);
        expect(matchesFilter({ kind: 'passage', id: 'x-y-z' }, ev({}))).toBe(false);
        expect(matchesFilter({ kind: 'trigger', id: 't1' }, ev({ kind: 'trigger', id: '*' }))).toBe(true);
        expect(matchesFilter({ kind: 'entity', id: 'items/bow' }, ev({ kind: 'entity', id: 'items/*' }))).toBe(true);
        expect(matchesFilter({ kind: 'entity', id: 'npcs/x' }, ev({ kind: 'entity', id: 'items/*' }))).toBe(false);
        expect(matchesFilter({ kind: 'passage', chapterId: 'a' }, ev({ chapterId: 'b' }))).toBe(false);
    });
});

describe('ApiEvents', () => {
    it('never opens a stream with createEventSource: null (mock mode), even when EventSource exists', () => {
        const EventSourceStub = vi.fn();
        vi.stubGlobal('EventSource', EventSourceStub);
        try {
            const events = new ApiEvents({ createEventSource: null });
            events.subscribe('chapter', () => {});
            expect(EventSourceStub).not.toHaveBeenCalled();
            expect(events.status).toBe('idle');
        } finally {
            vi.unstubAllGlobals();
        }
    });

    it('delivers events and drops the echo of an own save once', () => {
        const events = new ApiEvents({ createEventSource: undefined });
        const seen: TChangeEvent[] = [];
        events.subscribe('passage', (e) => seen.push(e));
        events.markSaved('mine');
        events.dispatch(ev({ version: 'mine' }));
        events.dispatch(ev({ version: 'theirs' }));
        events.dispatch(ev({ version: 'mine' }));
        expect(seen.map((e) => e.version)).toEqual(['theirs', 'mine']);
    });

    it('reconnects when the stream closes and signals a resync', () => {
        vi.useFakeTimers();
        const sources: {
            listeners: Record<string, (e: unknown) => void>;
            source: { readyState: number; onerror: (() => void) | null; close: () => void };
        }[] = [];
        const events = new ApiEvents({
            reconnectMinMs: 100,
            createEventSource: () => {
                const listeners: Record<string, (e: unknown) => void> = {};
                const source = {
                    readyState: 0,
                    onerror: null as (() => void) | null,
                    close: vi.fn(),
                    addEventListener: (name: string, l: (e: unknown) => void) => {
                        listeners[name] = l;
                    },
                };
                sources.push({ listeners, source });
                return source as never;
            },
        });
        const resync = vi.fn();
        events.onResync(resync);
        const seen: TChangeEvent[] = [];
        events.subscribe('*', (e) => seen.push(e));

        sources[0].listeners.hello({});
        sources[0].listeners.change({ data: JSON.stringify(ev({})) });
        expect(seen).toHaveLength(1);
        expect(resync).not.toHaveBeenCalled();

        sources[0].source.readyState = 2;
        sources[0].source.onerror?.();
        expect(events.status).toBe('reconnecting');
        vi.advanceTimersByTime(100);
        expect(sources).toHaveLength(2);
        sources[1].listeners.hello({});
        expect(resync).toHaveBeenCalledTimes(1);
        expect(events.status).toBe('open');
        events.close();
        vi.useRealTimers();
    });
});

describe('httpApi', () => {
    it('builds URLs from the protocol and throws ApiError with the body', async () => {
        const fetch = vi.fn((url: string, init?: RequestInit) => {
            if (url === '/api/chapters/village' && init?.method === 'PUT') {
                return Promise.resolve(
                    new Response(JSON.stringify({ error: 'stale', current: { version: 'v9' } }), { status: 409 })
                );
            }
            return Promise.resolve(
                new Response(JSON.stringify({ chapterId: 'village', version: 'v2' }), { status: 200 })
            );
        });
        const onSaved = vi.fn();
        const api = createHttpApi({ fetch: fetch as unknown as typeof globalThis.fetch, onSaved });

        await api.getChapter('village');
        expect(fetch).toHaveBeenLastCalledWith('/api/chapters/village', expect.objectContaining({ method: 'GET' }));
        expect(onSaved).not.toHaveBeenCalled();

        const error = await api.updateChapter('village', { version: 'v1', title: 'x' }).catch((e: unknown) => e);
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).status).toBe(409);
        expect((error as ApiError).isStale).toBe(true);
        expect((error as ApiError).current).toEqual({ version: 'v9' });

        await api.openChapter('a b');
        expect(fetch).toHaveBeenLastCalledWith('/api/chapters/a%20b/open', expect.objectContaining({ method: 'POST' }));
        expect(onSaved).toHaveBeenCalledWith('v2');
    });

    it('reports an unreachable server', async () => {
        const fetch = vi.fn(() => Promise.resolve(new Response('Bad gateway', { status: 502 })));
        const api = createHttpApi({ fetch: fetch as unknown as typeof globalThis.fetch });
        const error = (await api.health().catch((e: unknown) => e)) as ApiError;
        expect(error.status).toBe(502);
        expect(error.body.message).toMatch(/unreachable/);
    });
});

describe('mockApi', () => {
    it('serves the sample story with versions and edges', async () => {
        const api = createMockApi();
        const project = await api.getProject();
        expect(project.chapters.map((c) => c.id)).toEqual(['village', 'kingdom', 'wedding']);
        expect(project.chapters.find((c) => c.id === 'wedding')?.name).toBe('Wedding Chapter');
        const { passages, edges } = await api.listChapterPassages('village');
        expect(passages.map((p) => p.passageId).sort()).toEqual([
            'village-thomas-cool',
            'village-thomas-forest',
            'village-thomas-intro',
        ]);
        expect(edges).toContainEqual({
            from: 'village-thomas-intro',
            to: 'village-thomas-forest',
            kind: 'link',
            conditional: false,
            resolved: true,
        });
        expect(edges.find((e) => e.from === 'village-thomas-cool')?.resolved).toBe(false);
        expect(passages.every((p) => typeof p.version === 'string' && p.version !== '')).toBe(true);
    });

    it('rejects a stale version and accepts the current one', async () => {
        const events = new ApiEvents({ createEventSource: undefined });
        const seen: TChangeEvent[] = [];
        events.subscribe('*', (e) => seen.push(e));
        const api = createMockApi({ events });
        const chapter = await api.getChapter('village');

        const stale = await api.updateChapter('village', { version: 'old', title: 'x' }).catch((e: unknown) => e);
        expect((stale as ApiError).isStale).toBe(true);

        const saved = await api.updateChapter('village', { version: chapter.version, title: 'Village!' });
        expect(saved.title).toBe('Village!');
        expect(saved.version).not.toBe(chapter.version);
        await new Promise((r) => setTimeout(r, 0));
        expect(seen).toEqual([]); // own save: the echo is ignored

        api.simulateExternalChange('chapter', 'village');
        await new Promise((r) => setTimeout(r, 0));
        expect(seen).toHaveLength(1);
        expect(seen[0]).toMatchObject({ kind: 'chapter', id: 'village' });
    });

    it('adds and removes a chapter character, refusing while referenced', async () => {
        const api = createMockApi();
        let chapter = await api.addChapterCharacter('wedding', { characterId: 'thomas' });
        expect(chapter.characters).toEqual([
            { characterId: 'thomas', passageCount: 1, passageIds: ['wedding-thomas-intro'] },
        ]);
        const intro = await api.getPassage('kingdom-annie-intro');
        await api.updatePassage(intro.passageId, {
            version: intro.version,
            body: [{ links: [{ text: 'go', passageId: 'wedding-thomas-intro' }] }],
        });
        const refused = await api
            .removeChapterCharacter('wedding', 'thomas', { version: chapter.version })
            .catch((e: unknown) => e);
        expect((refused as ApiError).isReferenced).toBe(true);
        expect((refused as ApiError).references[0].passageId).toBe('kingdom-annie-intro');

        chapter = await api.getChapter('wedding');
        const current = await api.getPassage(intro.passageId);
        await api.updatePassage(intro.passageId, { version: current.version, body: [] });
        chapter = await api.removeChapterCharacter('wedding', 'thomas', { version: chapter.version });
        expect(chapter.characters).toEqual([]);
    });

    it('creates a missing JSON store with version ""', async () => {
        const api = createMockApi();
        const layout = await api.getChapterLayout('village');
        expect(layout.version).toBe('');
        const saved = await api.updateChapterLayout('village', {
            version: '',
            passages: { 'village-thomas-intro': { x: 1, y: 2 } },
        });
        expect(saved.version).not.toBe('');
        const again = await api.updateChapterLayout('village', { version: '', passages: {} }).catch((e: unknown) => e);
        expect((again as ApiError).isStale).toBe(true);
    });
});

describe('mockApi images', () => {
    it('has no images until one is uploaded, and keeps it in memory', async () => {
        const api = createMockApi();
        const none = await api.getImage('passages', 'village-thomas-intro');
        expect(none).toMatchObject({ file: 'data/chapters/village/thomas.passages/intro.png', version: '', url: null });
        const up = await api.uploadImage('npcs', 'franta', { version: '', data: 'iVBORw0KGgo=' });
        expect(up.file).toBe('data/npcs/Franta.png');
        expect(up.url).toBe('data:image/png;base64,iVBORw0KGgo=');
        expect(await api.getImage('npcs', 'franta')).toEqual(up);
        await expect(api.uploadImage('npcs', 'franta', { version: '', data: 'x' })).rejects.toMatchObject({
            isStale: true,
        });
        await expect(api.getImage('characters', 'nobody')).rejects.toBeInstanceOf(ApiError);
    });
});

describe('extractEdges', () => {
    it('finds passage ids inside code fields as conditional edges', () => {
        const edges = extractEdges([
            {
                passageId: 'c-a-x',
                chapterId: 'c',
                characterId: 'a',
                localId: 'x',
                version: 'v',
                file: 'f',
                params: ['s'],
                type: 'screen',
                title: 'X',
                image: '',
                body: [{ links: { code: "s.ok ? [{ text: 'a', passageId: 'c-a-y' }] : []" } }],
            },
        ]);
        expect(edges).toEqual([{ from: 'c-a-x', to: 'c-a-y', kind: 'link', conditional: true, resolved: false }]);
    });
});
