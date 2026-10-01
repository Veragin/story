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
import { listenLocal, login, makeTempProject, requestJson } from './helpers';

const run = promisify(execFile);

export const startSourceApp = async () => {
    const { storiesRoot, project, cleanup } = await makeTempProject();
    const app: TApp = await createApp({ storiesRoot, watch: false });
    const base = await listenLocal(app);
    const cookie = await login(base);
    const events: TChangeEvent[] = [];
    (await app.story('example')).bus.subscribe((e) => events.push(e));
    const call = (method: string, url: string, body?: unknown) =>
        requestJson(base + url, method, { body, headers: { cookie } });
    return {
        project,
        app,
        base,
        events,
        cookie,
        get: (url: string) => call('GET', url),
        post: (url: string, body: unknown) => call('POST', url, body),
        put: (url: string, body: unknown) => call('PUT', url, body),
        del: (url: string, body: unknown) => call('DELETE', url, body),
        close: async () => {
            await app.close();
            await cleanup();
        },
    };
};

/** Every file under `data/` and `types/` → its content. */
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

export const changedFiles = (a: Map<string, string>, b: Map<string, string>): string[] => {
    const keys = new Set([...a.keys(), ...b.keys()]);
    return [...keys].filter((k) => a.get(k) !== b.get(k)).sort();
};

/** The root `yarn typecheck`, with `@story/types` / `@story/data` resolved from the copy. */
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

/** Mirrors `KNOWN_DANGLING_REFERENCES` of `data/test/story.test.ts`. */
const KNOWN_DANGLING = ['village-thomas-cool -> village-thomas-'];

/** `data/test/story.test.ts`'s reference checks, statically on a fresh `SourceProject` from disk. */
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
