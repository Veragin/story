import { readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { TChangeEvent } from '@story/protocol';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventBus } from '../src/events/EventBus';
import { migrateClassLayout } from '../src/project/migrations/classLayout';
import { migrateStructureLayout } from '../src/project/migrations/structureLayout';
import { EXAMPLE_STORY_ROOT, type ProjectRoot } from '../src/project/ProjectRoot';
import { SourceProject } from '../src/project/SourceProject';
import { CLASS_FILES, fixtureDir, fixtureFiles, toPreClassLayout, writeFixture } from './helpers/fixtures';
import { login, requestJson, type TAny } from './helpers/http';
import { changedFiles, snapshot, tscTemp } from './helpers/sourceHelpers';
import { makeTempProject } from './helpers/storiesRoot';
import { createTestApp } from './helpers/testApp';

const FIXTURE_DIR = fixtureDir('preStructureLayout');
const ADDED_BY_MIGRATION = ['types/literals.ts', 'types/TNpc.ts'];

// the example story as it was before the structure layout: `TNpc` in `TCharacter.ts`, local `TItemInfo`s
const toPreMigration = async (project: ProjectRoot) => {
    await toPreClassLayout(project);
    await writeFixture(project, FIXTURE_DIR);
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
    // the class layout migration runs next, so only both together give the committed example
    it('with the class layout, turns the pre-migration example into the committed one, then is a no-op', async () => {
        const before = await snapshot(project.root);

        const first = await migrate(project);
        expect(first.steps).toEqual(['literals', 'npcFile', 'itemInfo']);
        expect(first.events).toEqual([
            { kind: 'structure', id: 'structure', version: expect.any(String), op: 'updated' },
        ]);
        const sp = new SourceProject(project);
        await sp.sync();
        expect(await migrateClassLayout(sp, new EventBus({ project }))).toEqual(['Character', 'Npc', 'Location']);
        const after = await snapshot(project.root);
        const changed = changedFiles(before, after);
        const touched = [
            ...(await fixtureFiles(FIXTURE_DIR)),
            ...(await fixtureFiles(fixtureDir('preClassLayout'))),
            ...ADDED_BY_MIGRATION,
            ...CLASS_FILES,
        ];
        // created by the layout migration, moved to `types/Npc.ts` by the class one
        const passing = 'types/TNpc.ts';
        expect(changed).toEqual([...new Set(touched)].filter((file) => file !== passing).sort());
        for (const file of changed) {
            const committed = await readFile(path.join(EXAMPLE_STORY_ROOT, file), 'utf8').catch(() => undefined);
            expect(after.get(file), file).toBe(committed);
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
        const app = await createTestApp({ storiesRoot, stories: ['example'] });
        try {
            const base = app.base;
            const cookie = await login(base);
            const { status, body } = await requestJson(`${base}/api/stories/example/structure`, 'GET', {
                headers: { cookie },
            });
            expect(status).toBe(200);
            const npc = body.types.find((t: TAny) => t.name === 'TNpcData');
            expect(npc).toMatchObject({ file: 'types/Npc.ts', origin: 'extendable' });
            expect(body.types.find((t: TAny) => t.name === 'TItemInfo')).toMatchObject({
                file: 'data/items/itemInfo.ts',
            });
            expect(await readFile(project.abs('types/literals.ts'), 'utf8')).toBe('export {};\n');
        } finally {
            await app.close();
        }
    }, 60_000);
});
