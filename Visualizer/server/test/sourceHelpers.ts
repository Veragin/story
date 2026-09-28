import { execFile } from 'node:child_process';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import type { TChangeEvent } from '@story/visualizer-protocol';
import { createApp, type TApp } from '../src/app';
import { ProjectRoot, REPO_ROOT } from '../src/project/ProjectRoot';
import { readChapterPassages } from '../src/project/readers/passages';
import { entitySources } from '../src/project/readers/entities';
import { SourceProject } from '../src/project/SourceProject';
import { chapterIds, registeredPassageIds } from '../src/project/story';
import { makeTempProject } from './helpers';

const run = promisify(execFile);

// Response bodies in tests are poked at freely; the DTO types are checked by the server code.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TAny = any;

export type TResponse<T = TAny> = { status: number; body: T };

/** A server over a temp copy of the story, plus small HTTP helpers. */
export const startSourceApp = async () => {
    const { project, cleanup } = await makeTempProject();
    const app: TApp = await createApp({ project, watch: false });
    const port = await app.listen(0, '127.0.0.1');
    const events: TChangeEvent[] = [];
    app.bus.subscribe((e) => events.push(e));
    const call = async <T = TAny>(method: string, url: string, body?: unknown): Promise<TResponse<T>> => {
        const res = await fetch(`http://127.0.0.1:${port}${url}`, {
            method,
            headers: body === undefined ? {} : { 'content-type': 'application/json' },
            body: body === undefined ? undefined : JSON.stringify(body),
        });
        return { status: res.status, body: (await res.json()) as T };
    };
    return {
        project,
        app,
        events,
        get: <T = TAny>(url: string) => call<T>('GET', url),
        post: <T = TAny>(url: string, body: unknown) => call<T>('POST', url, body),
        put: <T = TAny>(url: string, body: unknown) => call<T>('PUT', url, body),
        del: <T = TAny>(url: string, body: unknown) => call<T>('DELETE', url, body),
        close: async () => {
            await app.close();
            await cleanup();
        },
    };
};

/** Every file under `data/` and `types/` of a root → its content (for byte-identity checks). */
export const snapshot = async (root: string): Promise<Map<string, string>> => {
    const out = new Map<string, string>();
    const walk = async (dir: string) => {
        for (const e of await readdir(dir, { withFileTypes: true })) {
            const full = path.join(dir, e.name);
            if (e.isDirectory()) await walk(full);
            else out.set(path.relative(root, full), await readFile(full, 'utf8'));
        }
    };
    await walk(path.join(root, 'data'));
    await walk(path.join(root, 'types'));
    return out;
};

/** The files whose content differs between two snapshots (added / removed / changed). */
export const changedFiles = (a: Map<string, string>, b: Map<string, string>): string[] => {
    const keys = new Set([...a.keys(), ...b.keys()]);
    return [...keys].filter((k) => a.get(k) !== b.get(k)).sort();
};

/**
 * `tsc --noEmit` over the temp copy — the same check as the root `yarn typecheck`, with
 * `@story/shared` / `@story/core` resolved from the repo and `@story/types` / `@story/data` from
 * the copy. `data/test` (vitest) and `data/assets` (the favicon) are left out: neither is touched.
 */
export const tscTemp = async (root: string): Promise<{ ok: boolean; output: string }> => {
    const tsconfig = {
        extends: path.join(REPO_ROOT, 'tsconfig.base.json'),
        compilerOptions: {
            baseUrl: '.',
            types: [],
            paths: {
                '@story/types': ['types/index.ts'],
                '@story/data': ['data/index.ts'],
                '@story/data/*': ['data/*'],
                '@story/shared': [path.join(REPO_ROOT, 'shared/src/index.ts')],
                '@story/core': [path.join(REPO_ROOT, 'core/src/index.ts')],
            },
        },
        include: ['data', 'types'],
        exclude: ['data/test', 'data/assets', 'node_modules'],
    };
    const file = path.join(root, 'tsconfig.json');
    await writeFile(file, JSON.stringify(tsconfig, null, 4));
    try {
        const { stdout } = await run(process.execPath, [
            path.join(REPO_ROOT, 'node_modules/typescript/bin/tsc'),
            '--noEmit',
            '-p',
            file,
        ]);
        return { ok: true, output: stdout };
    } catch (e) {
        const err = e as { stdout?: string; stderr?: string };
        return { ok: false, output: `${err.stdout ?? ''}${err.stderr ?? ''}` };
    }
};

/** The dangling reference `data/test/story.test.ts` already knows about (`KNOWN_DANGLING_REFERENCES`). */
export const KNOWN_DANGLING = ['village-thomas-cool -> village-thomas-'];

/**
 * `data/test/story.test.ts`-style reference checks, done statically on the files of a root (a
 * fresh `SourceProject` straight from disk, so it sees exactly what was written):
 *  - every passage file of every chapter is registered in its `<ch>.passages.ts` Record, and
 *    every Record key has a file;
 *  - every link / redirect / next target is a registered passage (except the known dangling one);
 *  - every character's `startPassageId` is registered.
 * Returns the list of problems (empty = fine).
 */
export const storyProblems = async (root: string): Promise<string[]> => {
    const sp = new SourceProject(new ProjectRoot(root));
    await sp.sync();
    const registered = registeredPassageIds(sp);
    const problems: string[] = [];
    const files = new Set<string>();
    for (const ch of chapterIds(sp)) {
        const { passages, edges } = readChapterPassages(sp, ch);
        for (const p of passages) {
            files.add(p.passageId);
            if (!registered.has(p.passageId)) problems.push(`unregistered passage file ${p.passageId}`);
        }
        for (const e of edges) {
            if (!e.conditional && !e.resolved && !KNOWN_DANGLING.includes(`${e.from} -> ${e.to}`)) {
                problems.push(`dangling ${e.from} -> ${e.to}`);
            }
        }
    }
    for (const id of registered) if (!files.has(id)) problems.push(`registered passage without a file ${id}`);
    for (const c of entitySources(sp, 'characters')) {
        const start = c.obj.getProperty('startPassageId');
        const text = start?.getText().match(/'([^']*)'/)?.[1];
        if (text && !registered.has(text)) problems.push(`character ${c.id} starts on unknown ${text}`);
    }
    return problems;
};
