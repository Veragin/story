import { cp, mkdtemp, rm } from 'node:fs/promises';
import http from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { TChangeEvent } from '@story/visualizer-protocol';
import type { TApp } from '../src/app';
import { EXAMPLE_STORY_ROOT, ProjectRoot } from '../src/project/ProjectRoot';
import { STORY_FILE } from '../src/stories/StoryStore';

// Response bodies in tests are poked at freely; the DTO types are checked by the server code.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TAny = any;

export const copyExampleStory = async (storiesRoot: string, id: string): Promise<ProjectRoot> => {
    const dir = path.join(storiesRoot, id);
    const skip = (src: string) => !src.includes(`${path.sep}node_modules`);
    for (const entry of ['data', 'types', STORY_FILE, 'tsconfig.json']) {
        await cp(path.join(EXAMPLE_STORY_ROOT, entry), path.join(dir, entry), { recursive: true, filter: skip });
    }
    return new ProjectRoot(dir, id);
};

export const makeTempStories = async (
    ids: string[] = ['example']
): Promise<{ storiesRoot: string; projects: ProjectRoot[]; cleanup: () => Promise<void> }> => {
    const storiesRoot = await mkdtemp(path.join(tmpdir(), 'visualizer-server-'));
    const projects: ProjectRoot[] = [];
    for (const id of ids) projects.push(await copyExampleStory(storiesRoot, id));
    return { storiesRoot, projects, cleanup: () => rm(storiesRoot, { recursive: true, force: true }) };
};

export const makeTempProject = async (): Promise<{
    storiesRoot: string;
    project: ProjectRoot;
    cleanup: () => Promise<void>;
}> => {
    const { storiesRoot, projects, cleanup } = await makeTempStories();
    return { storiesRoot, project: projects[0], cleanup };
};

export const listenLocal = async (app: TApp) => `http://127.0.0.1:${await app.listen(0, '127.0.0.1')}`;

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Long enough for chokidar to report and a 50 ms batch to flush, with margin for a slow CI box. */
export const QUIET_MS = 700;

export const waitFor = async (predicate: () => boolean, timeoutMs = 5000) => {
    const start = Date.now();
    while (!predicate()) {
        if (Date.now() - start > timeoutMs) throw new Error('timed out');
        await sleep(20);
    }
};

export const EXAMPLE_PASSWORD = 'example';

/** Returns the `story_session=<token>` cookie; pass a previous one as `cookie` to add a grant to it. */
export const login = async (
    base: string,
    storyId = 'example',
    { password = EXAMPLE_PASSWORD, cookie }: { password?: string; cookie?: string } = {}
): Promise<string> => {
    const res = await fetch(`${base}/api/stories/${storyId}/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
        body: JSON.stringify({ password }),
    });
    if (res.status !== 204) throw new Error(`login to ${storyId} answered ${res.status}`);
    const setCookie = res.headers.get('set-cookie') ?? '';
    return setCookie.split(';')[0];
};

export type TJsonResponse = { status: number; headers: Headers; body: TAny };

/** Every mutation is sent as JSON: the server's CSRF check wants the content type. */
export const requestJson = async (
    url: string,
    method: string,
    { body, headers = {} }: { body?: unknown; headers?: Record<string, string> } = {}
): Promise<TJsonResponse> => {
    const res = await fetch(url, {
        method,
        headers: { ...(method === 'GET' ? {} : { 'content-type': 'application/json' }), ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, headers: res.headers, body: text ? JSON.parse(text) : undefined };
};

export type TSseFrame = { event: string; data: unknown };

/** Resolves once the `hello` frame arrived (or right away on a non-200 answer). */
export const openEventStream = async (url: string, headers: http.OutgoingHttpHeaders = {}) => {
    const frames: TSseFrame[] = [];
    const changes: TChangeEvent[] = [];
    const req = http.get(url, { headers });
    const response = await new Promise<http.IncomingMessage>((resolve) => req.on('response', resolve));
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
            if (!event || !data) continue;
            const parsed = JSON.parse(data);
            frames.push({ event, data: parsed });
            if (event === 'change') changes.push(parsed);
        }
    });
    if (response.statusCode === 200) await waitFor(() => frames.length > 0);
    return { response, frames, changes, close: () => req.destroy() };
};
