import { EventEmitter } from 'node:events';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { TOpenDto } from '@story/visualizer-protocol';
import { createApp, type TApp } from '../src/app';
import { editorCommand, openDeps, resolvePassageFile, type TSpawn } from '../src/open';
import { makeTempProject } from './helpers';

let app: TApp;
let base: string;
let cleanup: () => Promise<void>;
const realSpawn = openDeps.spawn;

beforeAll(async () => {
    const temp = await makeTempProject();
    cleanup = temp.cleanup;
    app = await createApp({ project: temp.project, watch: false });
    base = `http://127.0.0.1:${await app.listen(0, '127.0.0.1')}`;
});

afterAll(async () => {
    await app.close();
    await cleanup();
});

afterEach(() => {
    openDeps.spawn = realSpawn;
    vi.unstubAllEnvs();
});

/** A fake `spawn` that records its calls and then emits `spawn` or `error`. */
const fakeSpawn = (outcome: 'spawn' | Error) => {
    const calls: { command: string; args: readonly string[] }[] = [];
    openDeps.spawn = ((command: string, args: readonly string[]) => {
        calls.push({ command, args });
        const child = Object.assign(new EventEmitter(), { unref: () => undefined });
        setImmediate(() => (outcome === 'spawn' ? child.emit('spawn') : child.emit('error', outcome)));
        return child;
    }) as unknown as TSpawn;
    return calls;
};

const post = async (route: string) => {
    const res = await fetch(base + route, { method: 'POST' });
    return { status: res.status, json: (await res.json()) as TOpenDto & { error?: string } };
};

describe('open in editor', () => {
    it('opens a chapter file at its declaration', async () => {
        const calls = fakeSpawn('spawn');
        const { status, json } = await post('/api/chapters/village/open');
        expect(status).toBe(200);
        expect(json).toEqual({ ok: true, opened: true, file: 'data/chapters/village/village.chapter.ts', line: 5 });
        expect(calls).toEqual([
            { command: 'code', args: ['-g', `${app.project.abs('data/chapters/village/village.chapter.ts')}:5`] },
        ]);
    });

    it('resolves passage ids by path convention, including suffixed files', async () => {
        fakeSpawn('spawn');
        const intro = await post('/api/passages/village-thomas-intro/open');
        expect(intro.json).toMatchObject({ opened: true, file: 'data/chapters/village/thomas.passages/intro.ts' });
        expect(intro.json.line).toBeGreaterThan(1);

        const cool = await resolvePassageFile(app.project, 'village-thomas-cool');
        expect(app.project.rel(cool.file)).toBe('data/chapters/village/thomas.passages/cool.transition.ts');
        expect(cool.line).toBe(4); // `const coolPassage = …`, not exported

        const visit = await resolvePassageFile(app.project, 'kingdom-thomas-visit');
        expect(app.project.rel(visit.file)).toBe('data/chapters/kingdom/thomas.passages/visit.screen.ts');
    });

    it.each([
        '/api/chapters/nope/open',
        '/api/passages/village-thomas-nope/open',
        '/api/passages/village-nobody-intro/open',
        '/api/passages/nonsense/open',
        '/api/passages/..-..-etc/open',
    ])('404 for %s', async (route) => {
        const calls = fakeSpawn('spawn');
        const { status, json } = await post(route);
        expect(status).toBe(404);
        expect(json.error).toBe('not_found');
        expect(calls).toEqual([]);
    });

    it('answers opened: false when the editor cannot be started', async () => {
        fakeSpawn(Object.assign(new Error('spawn code ENOENT'), { code: 'ENOENT' }));
        const { status, json } = await post('/api/chapters/village/open');
        expect(status).toBe(200);
        expect(json).toMatchObject({
            ok: true,
            opened: false,
            file: 'data/chapters/village/village.chapter.ts',
            line: 5,
        });
        expect(json.message).toContain('ENOENT');
    });

    it('survives a real spawn of a missing command', async () => {
        vi.stubEnv('VISUALIZER_EDITOR', 'visualizer-no-such-editor-xyz');
        const { status, json } = await post('/api/chapters/village/open');
        expect(status).toBe(200);
        expect(json.opened).toBe(false);
    });

    it('VISUALIZER_EDITOR picks the command, with {file}/{line} placeholders', () => {
        expect(editorCommand('/a/b.ts', 7, 'code')).toEqual({ command: 'code', args: ['-g', '/a/b.ts:7'] });
        expect(editorCommand('/a/b.ts', 7, 'code-insiders --reuse-window')).toEqual({
            command: 'code-insiders',
            args: ['--reuse-window', '-g', '/a/b.ts:7'],
        });
        expect(editorCommand('/a/b.ts', 7, 'idea --line {line} {file}')).toEqual({
            command: 'idea',
            args: ['--line', '7', '/a/b.ts'],
        });
    });
});
