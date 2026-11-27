import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { TChangeEvent } from '@story/protocol';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventBus } from '../src/events/EventBus';
import { migratePassageStructure } from '../src/project/migrations/passageStructure';
import { EXAMPLE_STORY_ROOT, type ProjectRoot } from '../src/project/ProjectRoot';
import { SourceProject } from '../src/project/SourceProject';
import { TEMPLATE_ROOT } from '../src/stories/templateRoot';
import { login, requestJson } from './helpers/http';
import { changedFiles, snapshot, tscTemp } from './helpers/sourceHelpers';
import { makeTempProject } from './helpers/storiesRoot';
import { createTestApp } from './helpers/testApp';

const FIXTURE_DIR = path.join(import.meta.dirname, 'fixtures', 'prePassageStructure');
const PASSAGE_FILE = 'types/TPassage.ts';
const MIGRATED_FILES = [PASSAGE_FILE, 'types/index.ts'];

const fixture = (file: string) => readFile(path.join(FIXTURE_DIR, `${file}.txt`), 'utf8');

// the example story as it was while it declared the passage structure itself
const toPreMigration = async (project: ProjectRoot) => {
    for (const file of MIGRATED_FILES) await writeFile(project.abs(file), await fixture(file));
};

const migrate = async (project: ProjectRoot) => {
    const sp = new SourceProject(project);
    await sp.sync();
    const bus = new EventBus({ project });
    const events: TChangeEvent[] = [];
    bus.subscribe((e) => events.push(e));
    return { migrated: await migratePassageStructure(sp, bus), events };
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

describe('passage structure migration', () => {
    it('binds the shared structure like the committed example and the template, then is a no-op', async () => {
        expect((await tscTemp(project.root)).output).toBe('');
        const before = await snapshot(project.root);

        const first = await migrate(project);
        expect(first.migrated).toBe(true);
        expect(first.events).toEqual([
            { kind: 'structure', id: 'structure', version: expect.any(String), op: 'updated' },
        ]);
        const after = await snapshot(project.root);
        expect(changedFiles(before, after)).toEqual([...MIGRATED_FILES].sort());
        for (const file of MIGRATED_FILES) {
            expect(after.get(file), file).toBe(await readFile(path.join(EXAMPLE_STORY_ROOT, file), 'utf8'));
        }
        expect(after.get(PASSAGE_FILE)).toBe(await readFile(path.join(TEMPLATE_ROOT, PASSAGE_FILE), 'utf8'));
        expect((await tscTemp(project.root)).output).toBe('');

        const second = await migrate(project);
        expect(second).toEqual({ migrated: false, events: [] });
        expect(changedFiles(after, await snapshot(project.root))).toEqual([]);
    }, 60_000);

    it('leaves a structure the story extended alone and logs it', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const passageFile = project.abs(PASSAGE_FILE);
        const extended = (await fixture(PASSAGE_FILE)).replace("type: 'screen';", "type: 'screen';\n    mood: string;");
        await writeFile(passageFile, extended);
        const intro = project.abs('data/chapters/kingdom/annie.passages/intro.ts');
        await writeFile(
            intro,
            (await readFile(intro, 'utf8')).replace("title: _('Intro'),", "title: _('Intro'),\n        mood: 'calm',")
        );

        const { migrated, events } = await migrate(project);
        expect(migrated).toBe(false);
        expect(events).toEqual([]);
        expect(await readFile(passageFile, 'utf8')).toBe(extended);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('not migrated'));
    }, 60_000);

    it('leaves a file with declarations of its own alone and logs them', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const passageFile = project.abs(PASSAGE_FILE);
        const text = `${await fixture(PASSAGE_FILE)}\nexport type TMood = { name: string };\n`;
        await writeFile(passageFile, text);

        expect((await migrate(project)).migrated).toBe(false);
        expect(await readFile(passageFile, 'utf8')).toBe(text);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('TMood'));
    }, 60_000);

    it('runs before the first request of a story', async () => {
        const app = await createTestApp({ storiesRoot, stories: ['example'] });
        try {
            const cookie = await login(app.base);
            const { status } = await requestJson(`${app.base}/api/stories/example/structure`, 'GET', {
                headers: { cookie },
            });
            expect(status).toBe(200);
            expect(await readFile(project.abs(PASSAGE_FILE), 'utf8')).toBe(
                await readFile(path.join(EXAMPLE_STORY_ROOT, PASSAGE_FILE), 'utf8')
            );
        } finally {
            await app.close();
        }
    }, 60_000);
});
