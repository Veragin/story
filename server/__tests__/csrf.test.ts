import { afterEach, describe, expect, it } from 'vitest';
import { EXAMPLE_PASSWORD, login, requestJson } from './helpers/http';
import { stubbedApp } from './helpers/routeStubs';
import { createTestApp, seedStory, type TTestApp } from './helpers/testApp';

const { controllers, notYetPorted } = stubbedApp(['updateTimelineLayout', 'getTimelineLayout']);

let app: TTestApp | undefined;

const start = async (allowedOrigins?: string[]) => {
    app = await createTestApp({ controllers, notYetPorted, auth: allowedOrigins ? { allowedOrigins } : {} });
    await seedStory(app.app, 'secret', { public: false });
    return app.base;
};

afterEach(async () => {
    await app?.close();
    app = undefined;
});

const LAYOUT = '/api/stories/secret/layout/timeline';
const JSON_TYPE = { 'content-type': 'application/json; charset=utf-8' };

const send = (base: string, method: string, url: string, headers: Record<string, string>, body = '{"version":"1"}') =>
    fetch(base + url, { method, headers, body });

const tryLogin = (base: string, headers: Record<string, string>) =>
    send(base, 'POST', '/api/stories/secret/login', headers, JSON.stringify({ password: EXAMPLE_PASSWORD }));

describe('CSRF: content type and origin of every mutation', () => {
    it('wants application/json on a JSON mutation', async () => {
        const base = await start(['https://stories.example.com']);
        const cookie = await login(base, 'secret');
        for (const type of [undefined, 'text/plain', 'application/x-www-form-urlencoded', 'multipart/form-data']) {
            const res = await send(base, 'PUT', LAYOUT, { cookie, ...(type ? { 'content-type': type } : {}) });
            expect([type, res.status, await res.json()]).toEqual([
                type,
                400,
                { error: 'bad_request', message: 'Expected content-type application/json' },
            ]);
        }
        expect((await send(base, 'PUT', LAYOUT, { cookie, ...JSON_TYPE })).status).toBe(200);
        expect((await send(base, 'PUT', LAYOUT, { cookie, 'content-type': 'Application/JSON' })).status).toBe(200);
    });

    it('refuses a foreign or null origin, accepts listed, own and missing origins', async () => {
        const base = await start(['https://stories.example.com']);
        const cookie = await login(base, 'secret');
        const put = (origin?: string) =>
            send(base, 'PUT', LAYOUT, { cookie, ...JSON_TYPE, ...(origin === undefined ? {} : { origin }) });

        const evil = await put('https://evil.example');
        expect([evil.status, await evil.json()]).toEqual([
            403,
            { error: 'forbidden', message: 'Origin https://evil.example is not allowed (ALLOWED_ORIGINS)' },
        ]);
        expect((await put('null')).status).toBe(403);
        expect((await put('http://localhost:8100')).status).toBe(403);
        expect((await put('https://stories.example.com')).status).toBe(200);
        expect((await put('HTTPS://Stories.Example.com/')).status).toBe(200);
        // the server's own origin passes because the Vite proxy keeps Host
        expect((await put(base)).status).toBe(200);
        expect((await put()).status).toBe(200);
        const read = await fetch(base + LAYOUT, { headers: { cookie, origin: 'https://evil.example' } });
        expect(read.status).toBe(200);
    });

    it('checks login and logout too, before any story lookup', async () => {
        const base = await start(['https://stories.example.com']);
        expect((await tryLogin(base, { ...JSON_TYPE, origin: 'https://evil.example' })).status).toBe(403);
        expect((await send(base, 'POST', '/api/logout', {}, '')).status).toBe(400);
        expect((await send(base, 'POST', '/api/logout', JSON_TYPE, '')).status).toBe(204);
        expect((await send(base, 'PUT', LAYOUT, {})).status).toBe(400);
        expect((await send(base, 'PUT', LAYOUT, { ...JSON_TYPE, origin: 'https://evil.example' })).status).toBe(403);
        const missing = '/api/stories/nope/layout/timeline';
        expect((await send(base, 'PUT', missing, { ...JSON_TYPE, origin: 'https://evil.example' })).status).toBe(403);
        expect((await send(base, 'PUT', missing, JSON_TYPE)).status).toBe(404);
        expect((await send(base, 'PUT', LAYOUT, JSON_TYPE)).status).toBe(401);
    });

    it('wants a multipart form on importStory', async () => {
        const base = await start();
        for (const type of ['application/json', 'application/zip']) {
            const res = await send(base, 'POST', '/api/stories/import', { 'content-type': type });
            expect([type, res.status, await res.json()]).toEqual([
                type,
                400,
                { error: 'bad_request', message: 'Expected content-type multipart/form-data' },
            ]);
        }
        const form = new FormData();
        form.set('zip', new Blob([new Uint8Array([1, 2, 3])]), 'story.zip');
        const res = await fetch(`${base}/api/stories/import`, { method: 'POST', body: form });
        // past the CSRF check: the handler looks at the zip
        expect([res.status, (await res.json()).message]).toEqual([400, expect.stringMatching(/^Not a valid zip/)]);
    });

    it('allows the dev ports by default, 8125 included', async () => {
        const base = await start();
        for (const port of [8100, 8101, 8103, 8123, 8125]) {
            for (const host of ['localhost', '127.0.0.1']) {
                const res = await tryLogin(base, { ...JSON_TYPE, origin: `http://${host}:${port}` });
                expect([port, host, res.status]).toEqual([port, host, 204]);
            }
        }
        expect((await tryLogin(base, { ...JSON_TYPE, origin: 'http://localhost:9999' })).status).toBe(403);
    });

    it('accepts a GET from anywhere', async () => {
        const base = await start();
        const res = await requestJson(`${base}/api/session`, 'GET', { headers: { origin: 'https://evil.example' } });
        expect(res.status).toBe(200);
    });
});
