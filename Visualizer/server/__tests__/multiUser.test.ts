import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp, type TApp } from '../src/app';
import { listenLocal, login, makeTempProject, openEventStream, QUIET_MS, requestJson, sleep, waitFor } from './helpers';

let app: TApp;
let base: string;
let cleanup: () => Promise<void>;
const streams: (() => void)[] = [];

beforeEach(async () => {
    const temp = await makeTempProject();
    cleanup = temp.cleanup;
    // the watcher is on, as in production, so a duplicate echo from chokidar would show up
    app = await createApp({ storiesRoot: temp.storiesRoot, watch: true, batchMs: 50 });
    base = await listenLocal(app);
});

afterEach(async () => {
    streams.splice(0).forEach((close) => close());
    await app.close();
    await cleanup();
});

const connect = async () => {
    const cookie = await login(base);
    const call = (method: string, url: string, body?: unknown) =>
        requestJson(base + url, method, { body, headers: { cookie } });
    const stream = await openEventStream(`${base}/api/stories/example/events`, { cookie });
    streams.push(stream.close);
    expect(stream.response.statusCode).toBe(200);
    return {
        cookie,
        events: stream.changes,
        get: (url: string) => call('GET', url),
        put: (url: string, body: unknown) => call('PUT', url, body),
    };
};

const P = '/api/stories/example/passages/village-thomas-intro';
const SRC = '/api/stories/example/source/passage/village-thomas-intro';

describe('two users on one story', () => {
    it("A saves, B gets the event, and B's stale save gets 409 with current", async () => {
        const a = await connect();
        const b = await connect();
        expect(a.cookie).not.toBe(b.cookie);

        const seenByA = (await a.get(P)).body;
        const seenByB = (await b.get(P)).body;
        expect(seenByB.version).toBe(seenByA.version);

        const saved = await a.put(P, { version: seenByA.version, title: 'Written by A' });
        expect(saved.status).toBe(200);

        // A's tab drops its own echo (`markSaved`) by this version
        await waitFor(() => a.events.length > 0 && b.events.length > 0);
        await sleep(QUIET_MS);
        const expected = {
            kind: 'passage',
            id: 'village-thomas-intro',
            chapterId: 'village',
            version: saved.body.version,
            op: 'updated',
        };
        expect(b.events).toEqual([expected]);
        expect(a.events).toEqual([expected]);

        const stale = await b.put(P, { version: seenByB.version, title: 'Written by B' });
        expect(stale.status).toBe(409);
        expect(stale.body.error).toBe('stale');
        expect(stale.body.current).toEqual(saved.body);
        expect((await b.get(P)).body).toEqual(saved.body);

        const retry = await b.put(P, { version: stale.body.current.version, title: 'Written by B' });
        expect(retry.status).toBe(200);
        await waitFor(() => a.events.length > 1);
        expect(a.events[1]).toMatchObject({ id: 'village-thomas-intro', version: retry.body.version });
        expect((await a.get(P)).body.title).toBe('Written by B');
    });

    it('a source-editor save and a form-editor save of one passage conflict through the version check', async () => {
        const sourceUser = await connect();
        const formUser = await connect();

        const source = (await sourceUser.get(SRC)).body;
        const form = (await formUser.get(P)).body;
        expect(source.version).toBe(form.version);

        const text = source.text.replace(/title: '[^']*'/, "title: 'From source'");
        expect(text).not.toBe(source.text);
        const bySource = await sourceUser.put(SRC, { version: source.version, text });
        expect(bySource.status).toBe(200);
        await waitFor(() => formUser.events.length > 0);
        await sleep(QUIET_MS);
        expect(formUser.events).toEqual([
            expect.objectContaining({ kind: 'passage', id: 'village-thomas-intro', version: bySource.body.version }),
        ]);

        const staleForm = await formUser.put(P, { version: form.version, title: 'From form' });
        expect(staleForm.status).toBe(409);
        expect(staleForm.body.error).toBe('stale');
        expect(staleForm.body.current).toMatchObject({ title: 'From source' });
        expect(staleForm.body.current.version).toBe(bySource.body.version);

        const byForm = await formUser.put(P, { version: staleForm.body.current.version, title: 'From form' });
        expect(byForm.status).toBe(200);
        const staleSource = await sourceUser.put(SRC, { version: bySource.body.version, text });
        expect(staleSource.status).toBe(409);
        expect(staleSource.body.error).toBe('stale');
        expect(staleSource.body.current.version).toBe(byForm.body.version);
        expect(staleSource.body.current.text).toContain("title: 'From form'");
        expect((await formUser.get(P)).body.title).toBe('From form');
    });
});
