import { describe, expect, it, vi } from 'vitest';
import type { TChangeEvent } from '@story/visualizer-protocol';
import { ApiError } from '../ApiError';
import { AuthStore } from '../auth';
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

describe('ApiEvents after a lost grant', () => {
    it('probes when the browser gives up, and reconnects at once on reconnectNow', () => {
        vi.useFakeTimers();
        const sources: { readyState: number; onerror: (() => void) | null; close: () => void }[] = [];
        const onGiveUp = vi.fn();
        const events = new ApiEvents({
            reconnectMinMs: 10_000,
            onGiveUp,
            createEventSource: () => {
                const source = { readyState: 0, onerror: null, close: vi.fn(), addEventListener: vi.fn() };
                sources.push(source);
                return source as never;
            },
        });
        events.subscribe('*', () => {});
        // the stream is answered 401: the browser closes it
        sources[0].readyState = 2;
        sources[0].onerror?.();
        expect(onGiveUp).toHaveBeenCalledTimes(1);
        expect(sources).toHaveLength(1);
        // … the user logs in
        events.reconnectNow();
        expect(sources).toHaveLength(2);
        // nothing pending: a no-op
        events.reconnectNow();
        expect(sources).toHaveLength(2);
        events.close();
        vi.useRealTimers();
    });
});

describe('ApiEvents.hold', () => {
    it('holds events until the last release, then filters them against versions marked meanwhile', () => {
        const events = new ApiEvents({ createEventSource: undefined });
        const seen: TChangeEvent[] = [];
        events.subscribe('passage', (e) => seen.push(e));
        const outer = events.hold();
        const inner = events.hold();
        events.dispatch(ev({ version: 'mine' }));
        events.dispatch(ev({ version: 'theirs' }));
        events.markSaved('mine');
        inner();
        inner(); // idempotent
        expect(seen).toEqual([]);
        outer();
        expect(seen.map((e) => e.version)).toEqual(['theirs']);
    });

    it('lets go after holdMaxMs when the release never comes', () => {
        vi.useFakeTimers();
        try {
            const events = new ApiEvents({ createEventSource: undefined, holdMaxMs: 1000 });
            const seen: TChangeEvent[] = [];
            events.subscribe('passage', (e) => seen.push(e));
            events.hold();
            events.dispatch(ev({}));
            vi.advanceTimersByTime(999);
            expect(seen).toEqual([]);
            vi.advanceTimersByTime(1);
            expect(seen).toHaveLength(1);
        } finally {
            vi.useRealTimers();
        }
    });
});

describe('two tabs on one story', () => {
    // like the real server, a save's event fans out to every stream before the PUT is answered
    const startServer = () => {
        const streams: ((e: TChangeEvent) => void)[] = [];
        let passage = { id: 'village-thomas-intro', title: 'Intro', version: 'v1' };
        let n = 1;
        const fetch = vi.fn(async (url: string, init?: RequestInit) => {
            if (init?.method !== 'PUT') return new Response(JSON.stringify(passage), { status: 200 });
            const body = JSON.parse(String(init.body)) as { version: string; title?: string; text?: string };
            if (body.version !== passage.version) {
                return new Response(JSON.stringify({ error: 'stale', message: 'stale', current: passage }), {
                    status: 409,
                });
            }
            passage = { ...passage, title: body.title ?? body.text ?? passage.title, version: `v${++n}` };
            const event: TChangeEvent = {
                kind: 'passage',
                id: passage.id,
                chapterId: 'village',
                version: passage.version,
                op: 'updated',
            };
            streams.forEach((s) => s(event));
            // the response reaches the tab after the event
            await new Promise((r) => setTimeout(r, 0));
            const dto = url.includes('/source/')
                ? { file: 'x.ts', text: passage.title, version: passage.version }
                : passage;
            return new Response(JSON.stringify(dto), { status: 200 });
        });
        const openTab = () => {
            const events = new ApiEvents({
                createEventSource: () => {
                    const listeners: Record<string, (e: unknown) => void> = {};
                    streams.push((e) => listeners.change?.({ data: JSON.stringify(e) }));
                    return {
                        readyState: 1,
                        onerror: null,
                        close: vi.fn(),
                        addEventListener: (name: string, l: (e: unknown) => void) => {
                            listeners[name] = l;
                        },
                    } as never;
                },
            });
            const api = createHttpApi({
                storyId: 'example',
                fetch: fetch as unknown as typeof globalThis.fetch,
                onSaved: (version) => events.markSaved(version),
                onMutation: () => events.hold(),
            });
            const seen: TChangeEvent[] = [];
            events.subscribe({ kind: 'passage', id: 'village-thomas-intro' }, (e) => seen.push(e));
            return { events, api, seen };
        };
        return { openTab };
    };

    it("drops a save's echo only in the tab that saved it (own-save filtering is per tab, keyed on version)", async () => {
        const server = startServer();
        const a = server.openTab();
        const b = server.openTab();
        const id = 'village-thomas-intro';

        const loadedByB = await b.api.getPassage(id);
        const savedByA = await a.api.updatePassage(id, { version: 'v1', title: 'By A' });
        expect(savedByA.version).toBe('v2');
        // A saved v2: its own echo is dropped, B sees it and would refetch
        expect(a.seen).toEqual([]);
        expect(b.seen.map((e) => e.version)).toEqual(['v2']);

        // B's save from what it had loaded is stale; a failed save marks nothing
        const error = (await b.api
            .updatePassage(id, { version: loadedByB.version, title: 'By B' })
            .catch((e: unknown) => e)) as ApiError;
        expect(error).toBeInstanceOf(ApiError);
        expect(error.isStale).toBe(true);
        expect(error.current).toMatchObject({ version: 'v2', title: 'By A' });

        // B saves on top of current: now it is A that sees the event, not B
        await b.api.updatePassage(id, { version: 'v2', title: 'By B' });
        expect(a.seen.map((e) => e.version)).toEqual(['v3']);
        expect(b.seen.map((e) => e.version)).toEqual(['v2']);

        // A marking a version (even the one B just saved) does not touch B's filter
        a.events.markSaved('v9');
        b.events.dispatch({ kind: 'passage', id, version: 'v9', op: 'updated' });
        expect(b.seen.map((e) => e.version)).toEqual(['v2', 'v9']);

        // a source save is not an own save even in the tab that made it: both tabs' forms refetch
        await a.api.updateSource('passage', id, { version: 'v3', text: 'By source' });
        expect(a.seen.map((e) => e.version)).toEqual(['v3', 'v4']);
        expect(b.seen.map((e) => e.version)).toEqual(['v2', 'v9', 'v4']);

        a.events.close();
        b.events.close();
    });
});

describe('AuthStore', () => {
    it('opens one prompt for every waiting request, and settles them all on login', async () => {
        const login = vi.fn((password: string) =>
            password === 'right' ? Promise.resolve() : Promise.reject(new ApiError(401, { error: 'unauthorized' }))
        );
        const auth = new AuthStore('example', { login, storyName: () => Promise.resolve('Example') });
        const onLogin = vi.fn();
        auth.onLogin(onLogin);
        const a = auth.requireLogin();
        const b = auth.requireLogin();
        expect(auth.prompt).toEqual({ storyName: 'example' });
        await Promise.resolve();
        await Promise.resolve();
        expect(auth.prompt).toEqual({ storyName: 'Example' });

        await expect(auth.submit('wrong')).rejects.toMatchObject({ status: 401 });
        expect(auth.prompt).not.toBeNull();
        await auth.submit('right');
        await expect(Promise.all([a, b])).resolves.toEqual([undefined, undefined]);
        expect(auth.prompt).toBeNull();
        expect(onLogin).toHaveBeenCalledTimes(1);
    });

    it('rejects the waiting requests with their reason on cancel', async () => {
        const onCancel = vi.fn();
        const auth = new AuthStore('example', { login: () => Promise.resolve(), onCancel });
        const reason = new ApiError(401, { error: 'unauthorized' });
        const wait = auth.requireLogin(reason);
        auth.cancel();
        await expect(wait).rejects.toBe(reason);
        expect(onCancel).toHaveBeenCalled();
        expect(auth.prompt).toBeNull();
    });
});

describe('httpApi', () => {
    it('builds URLs from the protocol and throws ApiError with the body', async () => {
        const fetch = vi.fn((url: string, init?: RequestInit) => {
            if (url === '/api/stories/example/chapters/village' && init?.method === 'PUT') {
                return Promise.resolve(
                    new Response(JSON.stringify({ error: 'stale', current: { version: 'v9' } }), { status: 409 })
                );
            }
            return Promise.resolve(
                new Response(JSON.stringify({ chapterId: 'village', version: 'v2' }), { status: 200 })
            );
        });
        const onSaved = vi.fn();
        const api = createHttpApi({ storyId: 'example', fetch: fetch as unknown as typeof globalThis.fetch, onSaved });

        await api.getChapter('village');
        expect(fetch).toHaveBeenLastCalledWith(
            '/api/stories/example/chapters/village',
            expect.objectContaining({ method: 'GET' })
        );
        expect(onSaved).not.toHaveBeenCalled();

        const error = await api.updateChapter('village', { version: 'v1', title: 'x' }).catch((e: unknown) => e);
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).status).toBe(409);
        expect((error as ApiError).isStale).toBe(true);
        expect((error as ApiError).current).toEqual({ version: 'v9' });

        await api.updateChapter('a b', { version: 'v1', title: 'x' });
        expect(fetch).toHaveBeenLastCalledWith(
            '/api/stories/example/chapters/a%20b',
            expect.objectContaining({ method: 'PUT', headers: { 'content-type': 'application/json' } })
        );
        expect(onSaved).toHaveBeenCalledWith('v2');

        // a source save is not an own save: the pages must see its event
        onSaved.mockClear();
        await api.updateSource('passage', 'village-thomas-intro', { version: 'v1', text: '' });
        expect(fetch).toHaveBeenLastCalledWith(
            '/api/stories/example/source/passage/village-thomas-intro',
            expect.objectContaining({ method: 'PUT' })
        );
        expect(onSaved).not.toHaveBeenCalled();
    });

    it('asks for a login on 401 and retries once; fails with the 401 when it is cancelled', async () => {
        let unlocked = false;
        const fetch = vi.fn((url: string) =>
            Promise.resolve(
                unlocked || url.endsWith('/login')
                    ? new Response(JSON.stringify({ chapterId: 'village', version: 'v1' }), { status: 200 })
                    : new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 })
            )
        );
        const onUnauthorized = vi.fn(() => {
            unlocked = true;
            return Promise.resolve();
        });
        const api = createHttpApi({
            storyId: 'example',
            fetch: fetch as unknown as typeof globalThis.fetch,
            onUnauthorized,
        });
        await expect(api.getChapter('village')).resolves.toMatchObject({ chapterId: 'village' });
        expect(onUnauthorized).toHaveBeenCalledTimes(1);
        expect(fetch).toHaveBeenCalledTimes(2);

        unlocked = false;
        const cancelled = createHttpApi({
            storyId: 'example',
            fetch: fetch as unknown as typeof globalThis.fetch,
            onUnauthorized: (e) => Promise.reject(e),
        });
        await expect(cancelled.getChapter('village')).rejects.toMatchObject({ status: 401 });

        // still 401 after the login: no second prompt, the error goes to the caller
        const stubborn = createHttpApi({
            storyId: 'example',
            fetch: fetch as unknown as typeof globalThis.fetch,
            onUnauthorized: () => Promise.resolve(),
        });
        await expect(stubborn.getChapter('village')).rejects.toMatchObject({ status: 401 });
    });

    it('holds events while a mutation is in flight, but not while the password prompt is open', async () => {
        let unlocked = false;
        const fetch = vi.fn(() =>
            Promise.resolve(
                unlocked
                    ? new Response(JSON.stringify({ chapterId: 'village', version: 'v2' }), { status: 200 })
                    : new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 })
            )
        );
        let holds = 0;
        const heldDuringPrompt: number[] = [];
        const api = createHttpApi({
            storyId: 'example',
            fetch: fetch as unknown as typeof globalThis.fetch,
            onMutation: () => {
                holds++;
                let done = false;
                return () => {
                    if (!done) holds--;
                    done = true;
                };
            },
            onUnauthorized: () => {
                heldDuringPrompt.push(holds);
                unlocked = true;
                return Promise.resolve();
            },
        });
        await api.updateChapter('village', { version: 'v1', title: 'x' });
        expect(heldDuringPrompt).toEqual([0]);
        expect(holds).toBe(0);
        fetch.mockImplementationOnce(() => Promise.reject(new Error('offline')));
        await expect(api.updateChapter('village', { version: 'v2', title: 'y' })).rejects.toMatchObject({ status: 0 });
        expect(holds).toBe(0);
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
