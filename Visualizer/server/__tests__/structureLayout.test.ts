import { readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { TChangeEvent } from '@story/visualizer-protocol';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { EventBus } from '../src/events/EventBus';
import { migrateStructureLayout } from '../src/project/migrations/structureLayout';
import { EXAMPLE_STORY_ROOT, type ProjectRoot } from '../src/project/ProjectRoot';
import { SourceProject } from '../src/project/SourceProject';
import { listenLocal, login, makeTempProject, requestJson, type TAny } from './helpers';
import { changedFiles, snapshot, tscTemp } from './sourceHelpers';

const FIXTURE_DIR = path.join(import.meta.dirname, 'fixtures', 'preStructureLayout');
const ADDED_BY_MIGRATION = ['types/literals.ts', 'types/TNpc.ts'];

const fixtureFiles = async (dir = FIXTURE_DIR): Promise<string[]> => {
    const out: string[] = [];
    for (const e of await readdir(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) out.push(...(await fixtureFiles(full)));
        else out.push(path.relative(FIXTURE_DIR, full).replace(/\.txt$/, ''));
    }
    return out.sort();
};

/** The example story as it was before the structure layout: `TNpc` in `TCharacter.ts`, local `TItemInfo`s. */
const toPreMigration = async (project: ProjectRoot) => {
    for (const file of await fixtureFiles()) {
        await writeFile(project.abs(file), await readFile(path.join(FIXTURE_DIR, `${file}.txt`), 'utf8'));
    }
    for (const file of ADDED_BY_MIGRATION) await rm(project.abs(file));
};

const migrate = async (project: ProjectRoot) => {
    const sp = new SourceProject(project);
    await sp.sync();
    const bus = new EventBus({ project });
    const events: TChangeEvent[] = [];
    bus.subscribe((e) => events.push(e));
    return { steps: await migrateStructureLayout(sp, bus), events };
};

let project: ProjectRoot;
let storiesRoot: string;
let cleanup: () => Promise<void>;

beforeEach(async () => {
    ({ project, storiesRoot, cleanup } = await makeTempProject());
    await toPreMigration(project);
});
afterEach(async () => {
    vi.restoreAllMocks();
    await cleanup();
});

describe('structure layout migration', () => {
    it('turns the pre-migration example into the committed one, type-checked, and then is a no-op', async () => {
        expect((await tscTemp(project.root)).output).toBe('');
        const before = await snapshot(project.root);

        const first = await migrate(project);
        expect(first.steps).toEqual(['literals', 'npcFile', 'itemInfo']);
        expect(first.events).toEqual([
            { kind: 'structure', id: 'structure', version: expect.any(String), op: 'updated' },
        ]);
        const after = await snapshot(project.root);
        const changed = changedFiles(before, after);
        expect(changed).toEqual([...(await fixtureFiles()), ...ADDED_BY_MIGRATION].sort());
        for (const file of changed) {
            expect(after.get(file), file).toBe(await readFile(path.join(EXAMPLE_STORY_ROOT, file), 'utf8'));
        }
        expect((await tscTemp(project.root)).output).toBe('');

        const second = await migrate(project);
        expect(second).toEqual({ steps: [], events: [] });
        expect(changedFiles(after, await snapshot(project.root))).toEqual([]);
    }, 60_000);

    it('leaves item files of an unexpected shape alone and logs them', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const toolInfo = project.abs('data/items/toolInfo.ts');
        const text = (await readFile(toolInfo, 'utf8'))
            .replace("type: 'tool',", "type: 'tool' as const,")
            .replace('} as const;', '};');
        await writeFile(toolInfo, text);

        const { steps } = await migrate(project);
        expect(steps).toEqual(['literals', 'npcFile', 'itemInfo']);
        expect(await readFile(toolInfo, 'utf8')).toBe(text);
        expect(await readFile(project.abs('data/items/foodInfo.ts'), 'utf8')).toContain('satisfies Record<string');
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('data/items/toolInfo.ts'));
    }, 60_000);

    it('runs before the first request of a story', async () => {
        const app = await createApp({ storiesRoot, watch: false });
        try {
            const base = await listenLocal(app);
            const cookie = await login(base);
            const { status, body } = await requestJson(`${base}/api/stories/example/structure`, 'GET', {
                headers: { cookie },
            });
            expect(status).toBe(200);
            const npc = body.types.find((t: TAny) => t.name === 'TNpc');
            expect(npc).toMatchObject({ file: 'types/TNpc.ts', origin: 'extendable' });
            expect(body.types.find((t: TAny) => t.name === 'TItemInfo')).toMatchObject({
                file: 'data/items/itemInfo.ts',
            });
            expect(await readFile(project.abs('types/literals.ts'), 'utf8')).toBe('export {};\n');
        } finally {
            await app.close();
        }
    }, 60_000);
});
