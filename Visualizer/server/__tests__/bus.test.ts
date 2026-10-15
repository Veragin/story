import { appendFile, rm, writeFile } from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { TChangeEvent } from '@story/visualizer-protocol';
import { createApp, type TApp } from '../src/app';
import type { TServerContext } from '../src/context';
import { version } from '../src/events/version';
import { readTextOrNull } from '../src/json/atomicWrite';
import { listenLocal, login, makeTempProject, openEventStream, QUIET_MS, sleep, waitFor } from './helpers';

let app: TApp;
let story: TServerContext;
let cleanup: () => Promise<void>;
let events: TChangeEvent[];

beforeEach(async () => {
    const temp = await makeTempProject();
    cleanup = temp.cleanup;
    app = await createApp({ storiesRoot: temp.storiesRoot, watch: true, batchMs: 50 });
    story = await app.story('example');
    events = [];
    story.bus.subscribe((e) => events.push(e));
});

afterEach(async () => {
    await app.close();
    await cleanup();
});

describe('event bus: hand edits', () => {
    it('turns an edit of a passage file into one passage event carrying the content hash', async () => {
        const file = story.project.abs('data/chapters/village/thomas.passages/intro.ts');
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

    it("names a passage event after the file's id literal, not its file name", async () => {
        const file = story.project.abs('data/chapters/village/thomas.passages/intro.ts');
        const source = (await readTextOrNull(file)) ?? '';
        expect(source).toContain("id: 'intro'");
        await writeFile(file, source.replace("id: 'intro'", "id: 'introRenamed'"));
        await waitFor(() => events.length > 0);
        await sleep(QUIET_MS);
        expect(events.map((e) => e.id)).toEqual(['village-thomas-introRenamed']);
        await rm(file);
        await waitFor(() => events.length > 1);
        expect(events[1]).toMatchObject({ id: 'village-thomas-introRenamed', op: 'deleted' });
    });

    it('batches several edits of one resource into one event', async () => {
        const file = story.project.abs('data/characters/thomas.ts');
        for (let i = 0; i < 3; i++) await appendFile(file, `// ${i}\n`);
        await waitFor(() => events.length > 0);
        await sleep(QUIET_MS);
        expect(events.filter((e) => e.id === 'characters/thomas')).toHaveLength(1);
    });

    it('reports a deleted primary file with version null', async () => {
        await rm(story.project.abs('data/npcs/Franta.ts'));
        await waitFor(() => events.length > 0);
        expect(events[0]).toEqual({ kind: 'entity', id: 'npcs/franta', version: null, op: 'deleted' });
    });

    it('reports a new JSON store as created', async () => {
        await writeFile(story.project.paths.timelineLayout, '{"chapters":{},"triggers":{}}\n');
        await waitFor(() => events.length > 0);
        expect(events[0]).toMatchObject({ kind: 'layout', id: 'timeline', op: 'created' });
    });
});

describe('event bus: transactions', () => {
    it('a server write that touches four files produces exactly one event', async () => {
        const p = story.project.paths;
        const chapterSource = 'export const x = 1;\n';
        const result = await story.bus.transaction(async (tx) => {
            await tx.writeFile(p.chapterFile('forest'), chapterSource);
            await tx.writeFile(p.chapterPassagesFile('forest'), 'export default {};\n');
            await tx.writeFile(p.register, ((await readTextOrNull(p.register)) ?? '') + '// forest\n');
            await tx.writeFile(p.worldState, ((await readTextOrNull(p.worldState)) ?? '') + '// forest\n');
            tx.setEvent({ kind: 'chapter', id: 'forest', version: version(chapterSource), op: 'created' });
            return 'done';
        });
        expect(result).toBe('done');
        await sleep(QUIET_MS);
        await story.bus.settle();
        expect(events).toEqual([{ kind: 'chapter', id: 'forest', version: version(chapterSource), op: 'created' }]);
    });

    it('deleting a folder in a transaction is one event too', async () => {
        await story.bus.transaction(async (tx) => {
            await tx.deleteDir(story.project.paths.characterPassagesDir('village', 'thomas'));
            await tx.writeFile(story.project.paths.chapterPassagesFile('village'), 'export default {};\n');
            tx.setEvent({ kind: 'chapter', id: 'village', version: 'v', op: 'updated' });
        });
        await sleep(QUIET_MS);
        expect(events).toHaveLength(1);
    });

    it('emits nothing of its own when it throws, and the watcher reports what did land', async () => {
        const file = story.project.abs('data/characters/annie.ts');
        await expect(
            story.bus.transaction(async (tx) => {
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
        const file = story.project.abs('data/chapters/kingdom/annie.passages/palace.ts');
        await story.bus.transaction(async (tx) => {
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
            story.bus.transaction(async () => {
                order.push('a:start');
                await sleep(50);
                order.push('a:end');
            }),
            story.bus.transaction(() => {
                order.push('b:start');
                order.push('b:end');
                return Promise.resolve();
            }),
        ]);
        expect(order).toEqual(['a:start', 'a:end', 'b:start', 'b:end']);
    });
});

describe('GET /api/stories/:storyId/events', () => {
    it('streams hello, then one change event per edit', async () => {
        const base = await listenLocal(app);
        const cookie = await login(base);
        const { response, frames, close } = await openEventStream(`${base}/api/stories/example/events`, { cookie });
        expect(response.statusCode).toBe(200);
        expect(response.headers['content-type']).toContain('text/event-stream');
        expect(frames[0].event).toBe('hello');

        await appendFile(story.project.abs('data/locations/village.location.ts'), '// x\n');
        await waitFor(() => frames.length === 2);
        expect(frames[1]).toMatchObject({ event: 'change', data: { kind: 'entity', id: 'locations/village' } });
        close();
    });
});
