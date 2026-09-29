import http from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { TChangeEvent } from '@story/visualizer-protocol';
import { createApp, type TApp } from '../src/app';
import { login, makeTempProject, sleep } from './helpers';

/**
 * Multi-user editing (multiple stories, phase 10): two users, each with their own login (their own
 * session cookie), editing one story. The version check decides who wins; the SSE stream tells the
 * other one. The server runs with its watcher on, as in production, so a duplicate echo from
 * chokidar would show up here too.
 */

// Response bodies in tests are poked at freely; the DTO types are checked by the server code.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TAny = any;

/** Long enough for chokidar to report and a 50 ms batch to flush, with margin for a slow CI box. */
const QUIET_MS = 700;

let app: TApp;
let base: string;
let cleanup: () => Promise<void>;
const streams: http.ClientRequest[] = [];

beforeEach(async () => {
    const temp = await makeTempProject();
    cleanup = temp.cleanup;
    app = await createApp({ storiesRoot: temp.storiesRoot, watch: true, batchMs: 50 });
    base = `http://127.0.0.1:${await app.listen(0, '127.0.0.1')}`;
});

afterEach(async () => {
    streams.splice(0).forEach((req) => req.destroy());
    await app.close();
    await cleanup();
});

const waitFor = async (predicate: () => boolean, timeoutMs = 5000) => {
    const start = Date.now();
    while (!predicate()) {
        if (Date.now() - start > timeoutMs) throw new Error('timed out');
        await sleep(20);
    }
};

/** One user: their own login cookie, their own `/events` stream, and HTTP helpers carrying the cookie. */
const connect = async () => {
    const cookie = await login(base);
    const call = async (method: string, url: string, body?: unknown): Promise<{ status: number; body: TAny }> => {
        const res = await fetch(base + url, {
            method,
            headers: { cookie, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
            body: body === undefined ? undefined : JSON.stringify(body),
        });
        const text = await res.text();
        return { status: res.status, body: text ? JSON.parse(text) : undefined };
    };

    const events: TChangeEvent[] = [];
    let hello = false;
    const req = http.get(`${base}/api/stories/example/events`, { headers: { cookie } });
    streams.push(req);
    const response = await new Promise<http.IncomingMessage>((resolve) => req.on('response', resolve));
    expect(response.statusCode).toBe(200);
    let buffer = '';
    response.setEncoding('utf8');
    response.on('data', (chunk: string) => {
        buffer += chunk;
        let end;
        while ((end = buffer.indexOf('\n\n')) >= 0) {
            const frame = buffer.slice(0, end);
            buffer = buffer.slice(end + 2);
            const event = /^event: (.*)$/m.exec(frame)?.[1];
            const data = /^data: (.*)$/m.exec(frame)?.[1];
            if (event === 'hello') hello = true;
            if (event === 'change' && data) events.push(JSON.parse(data));
        }
    });
    await waitFor(() => hello);

    return {
        cookie,
        events,
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

        // both streams get exactly one event, carrying the version A's response returned — that
        // is what lets A's tab drop its own echo (`markSaved`) while B's tab refetches
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

        // B saves from what it saw before: refused, nothing written, and told what is there now
        const stale = await b.put(P, { version: seenByB.version, title: 'Written by B' });
        expect(stale.status).toBe(409);
        expect(stale.body.error).toBe('stale');
        expect(stale.body.current).toEqual(saved.body);
        expect((await b.get(P)).body).toEqual(saved.body);

        // B retries on top of current: accepted, and A hears about it
        const retry = await b.put(P, { version: stale.body.current.version, title: 'Written by B' });
        expect(retry.status).toBe(200);
        await waitFor(() => a.events.length > 1);
        expect(a.events[1]).toMatchObject({ id: 'village-thomas-intro', version: retry.body.version });
        expect((await a.get(P)).body.title).toBe('Written by B');
    });

    it('a source-editor save and a form-editor save of one passage conflict through the version check', async () => {
        const a = await connect(); // the source editor
        const b = await connect(); // the passage form

        // the source file's version is the passage DTO's version, so either save outdates the other
        const source = (await a.get(SRC)).body;
        const form = (await b.get(P)).body;
        expect(source.version).toBe(form.version);

        // the source editor saves first → the form's save is stale
        const text = source.text.replace(/title: '[^']*'/, "title: 'From source'");
        expect(text).not.toBe(source.text);
        const bySource = await a.put(SRC, { version: source.version, text });
        expect(bySource.status).toBe(200);
        await waitFor(() => b.events.length > 0);
        await sleep(QUIET_MS);
        expect(b.events).toEqual([
            expect.objectContaining({ kind: 'passage', id: 'village-thomas-intro', version: bySource.body.version }),
        ]);

        const staleForm = await b.put(P, { version: form.version, title: 'From form' });
        expect(staleForm.status).toBe(409);
        expect(staleForm.body.error).toBe('stale');
        expect(staleForm.body.current).toMatchObject({ title: 'From source' });
        expect(staleForm.body.current.version).toBe(bySource.body.version);

        // the form saves on top of it → now the source editor's version is the stale one
        const byForm = await b.put(P, { version: staleForm.body.current.version, title: 'From form' });
        expect(byForm.status).toBe(200);
        const staleSource = await a.put(SRC, { version: bySource.body.version, text });
        expect(staleSource.status).toBe(409);
        expect(staleSource.body.error).toBe('stale');
        expect(staleSource.body.current.version).toBe(byForm.body.version);
        expect(staleSource.body.current.text).toContain("title: 'From form'");
        expect((await b.get(P)).body.title).toBe('From form');
    });
});
