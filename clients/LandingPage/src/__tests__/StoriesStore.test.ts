import { describe, expect, it, vi } from 'vitest';
import type { TStoryInfoDto, TStoryListItemDto } from '@story/protocol';
import { passwordErrorMessage } from '@story/ui';
import { ApiError, createLandingApi } from '../api';
import { StoriesStore } from '../StoriesStore';

const story = (id: string, extra: Partial<TStoryListItemDto> = {}): TStoryListItemDto => ({
    id,
    name: id.toUpperCase(),
    author: 'Me',
    description: '',
    mapSize: { width: 40, height: 30 },
    public: false,
    unlocked: false,
    ...extra,
});

const json = (status: number, body?: unknown) =>
    new Response(body === undefined ? null : JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
    });

type TCall = { method: string; url: string; headers: Record<string, string>; body: unknown };

// every story's password is `secret`
const setup = ({ tooMany = false, infoStatus = [200], gitSetupStatus = 200 } = {}) => {
    const stories = [story('locked'), story('open', { unlocked: true }), story('pub', { public: true })];
    const calls: TCall[] = [];
    const infoAnswers = [...infoStatus];
    const answer = (input: RequestInfo | URL, init: RequestInit = {}): Response => {
        const url = String(input);
        const method = init.method ?? 'GET';
        const body = typeof init.body === 'string' ? JSON.parse(init.body) : init.body;
        calls.push({ method, url, headers: (init.headers ?? {}) as Record<string, string>, body });
        const login = /^\/api\/stories\/([^/]+)\/login$/.exec(url);
        if (method === 'GET' && url === '/api/stories') return json(200, stories);
        if (method === 'POST' && login) {
            if (tooMany) return json(429, { error: 'too_many_requests', message: 'slow down' });
            if ((body as { password: string }).password !== 'secret') {
                return json(401, { error: 'unauthorized', message: 'Wrong password' });
            }
            const s = stories.find((x) => x.id === login[1])!;
            s.unlocked = true;
            return new Response(null, { status: 204 });
        }
        if (method === 'GET' && url === '/api/stories/open/info') {
            const status = infoAnswers.shift() ?? 200;
            if (status === 401) return json(401, { error: 'unauthorized', message: 'locked' });
            const info: TStoryInfoDto & { unlocked?: boolean } = { ...stories[1], version: 'v1' };
            delete info.unlocked;
            return json(200, info);
        }
        if (method === 'POST' && url === '/api/stories/import') return json(201, story('copy'));
        if (method === 'GET' && url === '/api/health') return json(200, { ok: true, git: 'up' });
        if (method === 'POST' && url === '/api/stories') {
            stories.push(story('fresh', { unlocked: true }));
            return json(201, story('fresh'));
        }
        if (method === 'POST' && url === '/api/stories/fresh/git/setup') {
            if (gitSetupStatus !== 200) return json(gitSetupStatus, { error: 'git_auth', message: 'Bad token' });
            return json(200, { available: true, config: null, status: null });
        }
        return json(404, { error: 'not_found' });
    };
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => Promise.resolve(answer(input, init)));
    const navigate = vi.fn();
    const store = new StoriesStore(createLandingApi({ fetch: fetchMock as typeof fetch }), navigate);
    return { store, calls, navigate, fetchMock };
};

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('StoriesStore', () => {
    it('loads the list with the unlocked flags', async () => {
        const { store } = setup();
        await store.load();
        expect(store.stories.map((s) => s.id)).toEqual(['locked', 'open', 'pub']);
        expect(store.isUnlocked('open')).toBe(true);
        expect(store.isUnlocked('locked')).toBe(false);
    });

    it('opens an unlocked story at once, without the password prompt', async () => {
        const { store, navigate } = setup();
        await store.load();
        await store.open('open');
        expect(store.prompt).toBeNull();
        expect(navigate).toHaveBeenCalledWith(`http://${window.location.hostname}:8101/?story=open#/map`);
    });

    it('asks for the password of a locked story, keeps asking on a wrong one, then opens it', async () => {
        const { store, navigate, calls } = setup();
        await store.load();
        const opening = store.open('locked');
        await tick();
        expect(store.prompt?.id).toBe('locked');
        expect(navigate).not.toHaveBeenCalled();

        const wrong = await store.submitPassword('nope').catch((e: unknown) => e);
        expect(wrong).toBeInstanceOf(ApiError);
        expect((wrong as ApiError).status).toBe(401);
        expect(passwordErrorMessage(wrong)).toBe('Wrong password.');
        expect(store.prompt?.id).toBe('locked'); // still open

        await store.submitPassword('secret');
        await opening;
        expect(store.prompt).toBeNull();
        expect(store.isUnlocked('locked')).toBe(true);
        expect(navigate).toHaveBeenCalledWith(`http://${window.location.hostname}:8101/?story=locked#/map`);

        const login = calls.filter((c) => c.url === '/api/stories/locked/login').pop()!;
        expect(login.method).toBe('POST');
        expect(login.headers['content-type']).toBe('application/json');
        expect(login.body).toEqual({ password: 'secret' });
    });

    it('does nothing when the prompt is cancelled', async () => {
        const { store, navigate } = setup();
        await store.load();
        const exporting = store.exportStory('locked');
        await tick();
        store.cancelPassword();
        await exporting;
        expect(store.prompt).toBeNull();
        expect(navigate).not.toHaveBeenCalled();
    });

    it('exports through the same-origin /api path once unlocked', async () => {
        const { store, navigate } = setup();
        await store.load();
        await store.exportStory('open');
        expect(navigate).toHaveBeenCalledWith('/api/stories/open/export');
    });

    it('plays a public story without the password, and asks for a private one', async () => {
        const { store, navigate } = setup();
        await store.load();
        await store.play('pub');
        expect(store.prompt).toBeNull();
        expect(navigate).toHaveBeenLastCalledWith(`http://${window.location.hostname}:8100/?story=pub`);

        const playing = store.play('locked');
        await tick();
        expect(store.prompt?.id).toBe('locked');
        store.cancelPassword();
        await playing;
        expect(navigate).toHaveBeenCalledTimes(1);
    });

    it('rejects with the 429 of too many attempts, worded by passwordErrorMessage', async () => {
        const { store } = setup({ tooMany: true });
        await store.load();
        void store.open('locked');
        await tick();
        const err = await store.submitPassword('secret').catch((e: unknown) => e);
        expect((err as ApiError).status).toBe(429);
        expect(passwordErrorMessage(err)).toMatch(/too many/i);
        expect(store.prompt?.id).toBe('locked');
    });

    it('asks again and retries once when the server says 401 for a story the list called unlocked', async () => {
        const { store } = setup({ infoStatus: [401, 200] });
        await store.load();
        const loading = store.loadInfo('open');
        await tick();
        expect(store.prompt?.id).toBe('open'); // the grant expired: marked locked, prompt opened
        expect(store.isUnlocked('open')).toBe(false);
        await store.submitPassword('secret');
        expect((await loading)?.version).toBe('v1');
    });

    it('imports the zip as a multipart form with the story fields', async () => {
        const { store, calls } = setup();
        const zip = new Blob([new Uint8Array([0x50, 0x4b])], { type: 'application/zip' });
        const body = { name: 'My copy', author: 'Me', password: 'secret-1', description: '', public: true };
        const imported = await store.importZip(zip, body);
        expect(imported.id).toBe('copy');
        const call = calls.find((c) => c.url.startsWith('/api/stories/import'))!;
        expect(call.url).toBe('/api/stories/import');
        expect(call.method).toBe('POST');
        expect(call.headers['content-type']).toBeUndefined(); // the browser adds the multipart boundary
        const form = call.body as FormData;
        expect(Object.fromEntries([...form].filter(([key]) => key !== 'zip'))).toEqual({
            name: 'My copy',
            author: 'Me',
            password: 'secret-1',
            description: '',
            public: 'true',
        });
        expect(form.get('zip')).toBeInstanceOf(Blob);
    });

    it('reads from the health check whether the server has git', async () => {
        const { store } = setup();
        expect(store.gitAvailable).toBe(false);
        await store.checkGit();
        expect(store.gitAvailable).toBe(true);
    });

    const createBody = {
        name: 'Fresh',
        author: 'Me',
        password: 'secret-1',
        description: '',
        mapSize: { width: 40, height: 30 },
        public: false,
    };
    const gitBody = {
        remoteUrl: 'https://example.com/me/fresh.git',
        branch: 'main',
        initial: 'push' as const,
        token: 'tkn',
    };

    it('connects a created story to its repository', async () => {
        const { store, calls } = setup();
        const result = await store.create(createBody, gitBody);
        expect(result).toEqual({ story: story('fresh'), gitError: null });
        const call = calls.find((c) => c.url === '/api/stories/fresh/git/setup')!;
        expect(call.method).toBe('POST');
        expect(call.body).toEqual(gitBody);
    });

    it('keeps a created story when connecting it to git fails', async () => {
        const { store } = setup({ gitSetupStatus: 400 });
        const result = await store.create(createBody, gitBody);
        expect(result).toEqual({ story: story('fresh'), gitError: 'Bad token' });
        expect(store.story('fresh')).toBeDefined();
    });

    it('creates without a git call when no repository is given', async () => {
        const { store, calls } = setup();
        await store.create(createBody, null);
        expect(calls.some((c) => c.url.includes('/git/'))).toBe(false);
    });
});
