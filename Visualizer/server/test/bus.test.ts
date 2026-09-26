import { appendFile, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { TChangeEvent } from '@story/visualizer-protocol';
import { createApp, type TApp } from '../src/app';
import { version } from '../src/events/version';
import { readTextOrNull } from '../src/json/atomicWrite';
import { makeTempProject, sleep } from './helpers';

/** Long enough for chokidar to report and a 50 ms batch to flush, with margin for a slow CI box. */
const QUIET_MS = 700;

let app: TApp;
let cleanup: () => Promise<void>;
let events: TChangeEvent[];

beforeEach(async () => {
    const temp = await makeTempProject();
    cleanup = temp.cleanup;
    app = await createApp({ project: temp.project, watch: true, batchMs: 50 });
    events = [];
    app.bus.subscribe((e) => events.push(e));
});

afterEach(async () => {
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

describe('event bus: hand edits', () => {
    it('turns an edit of a passage file into one passage event carrying the content hash', async () => {
        const file = app.project.abs('data/chapters/village/thomas.passages/intro.ts');
        await appendFile(file, '\n// edited by hand\n');
        await waitFor(() => events.length > 0);
        await sleep(QUIET_MS);
        const contents = await readTextOrNull(file);
        expect(events).toEqual([
            {
                kind: 'passage',
                id: 'village-thomas-intro',
                chapterId: 'village',
                version: version(contents),
                op: 'updated',
            },
        ]);
    });

    it('batches several edits of one resource into one event', async () => {
        const file = app.project.abs('data/characters/thomas.ts');
        for (let i = 0; i < 3; i++) await appendFile(file, `// ${i}\n`);
        await waitFor(() => events.length > 0);
        await sleep(QUIET_MS);
        expect(events.filter((e) => e.id === 'characters/thomas')).toHaveLength(1);
    });

    it('reports a deleted primary file with version null', async () => {
        await rm(app.project.abs('data/npcs/Franta.ts'));
        await waitFor(() => events.length > 0);
        expect(events[0]).toEqual({ kind: 'entity', id: 'npcs/franta', version: null, op: 'deleted' });
    });

    it('reports a new JSON store as created', async () => {
        await writeFile(app.project.paths.timelineLayout, '{"chapters":{},"triggers":{}}\n');
        await waitFor(() => events.length > 0);
        expect(events[0]).toMatchObject({ kind: 'layout', id: 'timeline', op: 'created' });
    });
});

describe('event bus: transactions', () => {
    it('a server write that touches four files produces exactly one event', async () => {
        const p = app.project.paths;
        const chapterSource = 'export const x = 1;\n';
        const result = await app.bus.transaction(async (tx) => {
            await tx.writeFile(p.chapterFile('forest'), chapterSource);
            await tx.writeFile(p.chapterPassagesFile('forest'), 'export default {};\n');
            await tx.writeFile(p.register, ((await readTextOrNull(p.register)) ?? '') + '// forest\n');
            await tx.writeFile(p.worldState, ((await readTextOrNull(p.worldState)) ?? '') + '// forest\n');
            tx.setEvent({ kind: 'chapter', id: 'forest', version: version(chapterSource), op: 'created' });
            return 'done';
        });
        expect(result).toBe('done');
        await sleep(QUIET_MS);
        await app.bus.settle();
        expect(events).toEqual([{ kind: 'chapter', id: 'forest', version: version(chapterSource), op: 'created' }]);
    });

    it('deleting a folder in a transaction is one event too', async () => {
        await app.bus.transaction(async (tx) => {
            await tx.deleteDir(app.project.paths.characterPassagesDir('village', 'thomas'));
            await tx.writeFile(app.project.paths.chapterPassagesFile('village'), 'export default {};\n');
            tx.setEvent({ kind: 'chapter', id: 'village', version: 'v', op: 'updated' });
        });
        await sleep(QUIET_MS);
        expect(events).toHaveLength(1);
    });

    it('emits nothing of its own when it throws, and the watcher reports what did land', async () => {
        const file = app.project.abs('data/characters/annie.ts');
        await expect(
            app.bus.transaction(async (tx) => {
                await tx.writeFile(file, '// half done\n');
                tx.setEvent({ kind: 'entity', id: 'characters/annie', version: 'never', op: 'updated' });
                throw new Error('validation failed');
            })
        ).rejects.toThrow('validation failed');
        await waitFor(() => events.length > 0);
        await sleep(QUIET_MS);
        expect(events).toEqual([
            { kind: 'entity', id: 'characters/annie', version: version('// half done\n'), op: 'updated' },
        ]);
    });

    it('still reports a hand edit made right after a server write', async () => {
        const file = app.project.abs('data/chapters/kingdom/annie.passages/palace.ts');
        await app.bus.transaction(async (tx) => {
            await tx.writeFile(file, '// server\n');
            tx.setEvent({ kind: 'passage', id: 'kingdom-annie-palace', version: version('// server\n') });
        });
        await sleep(200);
        await writeFile(file, '// author\n');
        await waitFor(() => events.length > 1);
        await sleep(QUIET_MS);
        expect(events.map((e) => e.version)).toEqual([version('// server\n'), version('// author\n')]);
    });

    it('runs transactions one at a time', async () => {
        const order: string[] = [];
        await Promise.all([
            app.bus.transaction(async () => {
                order.push('a:start');
                await sleep(50);
                order.push('a:end');
            }),
            app.bus.transaction(() => {
                order.push('b:start');
                order.push('b:end');
                return Promise.resolve();
            }),
        ]);
        expect(order).toEqual(['a:start', 'a:end', 'b:start', 'b:end']);
    });
});

describe('GET /api/events', () => {
    it('streams hello, then one change event per edit', async () => {
        const port = await app.listen(0, '127.0.0.1');
        const received: { event: string; data: unknown }[] = [];
        const req = http.get(`http://127.0.0.1:${port}/api/events`);
        const response = await new Promise<http.IncomingMessage>((resolve) => req.on('response', resolve));
        expect(response.statusCode).toBe(200);
        expect(response.headers['content-type']).toContain('text/event-stream');
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
                if (event && data) received.push({ event, data: JSON.parse(data) });
            }
        });
        await waitFor(() => received.length === 1);
        expect(received[0].event).toBe('hello');

        await appendFile(app.project.abs('data/locations/village.location.ts'), '// x\n');
        await waitFor(() => received.length === 2);
        expect(received[1]).toMatchObject({ event: 'change', data: { kind: 'entity', id: 'locations/village' } });
        req.destroy();
    });
});
