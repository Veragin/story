import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { TChangeEvent } from '@story/protocol';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventBus } from '../src/events/EventBus';
import { migrateClassLayout } from '../src/project/migrations/classLayout';
import { EXAMPLE_STORY_ROOT, type ProjectRoot } from '../src/project/ProjectRoot';
import { SourceProject } from '../src/project/SourceProject';
import { CLASS_FILES, fixtureDir, fixtureFiles, toPreClassLayout } from './helpers/fixtures';
import { login, requestJson, type TAny } from './helpers/http';
import { changedFiles, snapshot, tscTemp } from './helpers/sourceHelpers';
import { makeTempProject } from './helpers/storiesRoot';
import { createTestApp } from './helpers/testApp';

const FIXTURE_DIR = fixtureDir('preClassLayout');

const migrate = async (project: ProjectRoot) => {
    const sp = new SourceProject(project);
    await sp.sync();
    const bus = new EventBus({ project });
    const events: TChangeEvent[] = [];
    bus.subscribe((e) => events.push(e));
    return { steps: await migrateClassLayout(sp, bus), events };
};

let project: ProjectRoot;
let storiesRoot: string;
let cleanup: () => Promise<void>;

beforeEach(async () => {
    ({ project, storiesRoot, cleanup } = await makeTempProject());
    await toPreClassLayout(project);
});
afterEach(async () => {
    vi.restoreAllMocks();
    await cleanup();
});

describe('class layout migration', () => {
    it('turns the pre-migration example into the committed one, type-checked, and then is a no-op', async () => {
        const before = await snapshot(project.root);

        const first = await migrate(project);
        expect(first.steps).toEqual(['Character', 'Npc', 'Location']);
        expect(first.events).toEqual([
            { kind: 'structure', id: 'structure', version: expect.any(String), op: 'updated' },
        ]);
        const after = await snapshot(project.root);
        const changed = changedFiles(before, after);
        expect(changed).toEqual([...(await fixtureFiles(FIXTURE_DIR)), ...CLASS_FILES].sort());
        for (const file of changed) {
            const committed = await readFile(path.join(EXAMPLE_STORY_ROOT, file), 'utf8').catch(() => undefined);
            expect(after.get(file), file).toBe(committed);
        }
        expect((await tscTemp(project.root)).output).toBe('');

        const second = await migrate(project);
        expect(second).toEqual({ steps: [], events: [] });
        expect(changedFiles(after, await snapshot(project.root))).toEqual([]);
    }, 60_000);

    it('makes a class import type-only, alone or next to values', async () => {
        const kingdom = project.abs('data/locations/kingdom.location.ts');
        const text = await readFile(kingdom, 'utf8');
        await writeFile(
            kingdom,
            text
                .replace(
                    "import { TLocation } from '@story/types';",
                    "import { TLocation, getWholePassageId } from '@story/types';"
                )
                .replace(/\n$/, '\n\nexport const passageIdOf = getWholePassageId;\n')
        );

        expect((await migrate(project)).steps).toEqual(['Character', 'Npc', 'Location']);
        expect(await readFile(kingdom, 'utf8')).toContain(
            "import { type Location, getWholePassageId } from '@story/types';"
        );
        expect(await readFile(project.abs('data/TWorldState.ts'), 'utf8')).toContain(
            "import type { TChapter, Character, TCharacterData, TCharacterId, Location, Npc, TNpcData } from '@story/types';"
        );
    }, 60_000);

    it('leaves a type that is not a plain object type alone and logs it', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const npcFile = project.abs('types/TNpc.ts');
        const text = (await readFile(npcFile, 'utf8')).replace(
            '    image?: string;\n',
            '    image?: string;\n    greet(): void;\n'
        );
        await writeFile(npcFile, text);

        const { steps } = await migrate(project);
        expect(steps).toEqual(['Character', 'Location']);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('types/TNpc.ts'));
        expect(await readFile(npcFile, 'utf8')).toContain('export type TNpc<Ch extends TNpcId> = {');
        expect(await readFile(project.abs('data/npcs/Franta.ts'), 'utf8')).toContain(
            "import { TNpc } from '@story/types';"
        );
    }, 60_000);

    it('runs before the first request of a story', async () => {
        const app = await createTestApp({ storiesRoot, stories: ['example'] });
        try {
            const cookie = await login(app.base);
            const { status, body } = await requestJson(`${app.base}/api/stories/example/structure`, 'GET', {
                headers: { cookie },
            });
            expect(status).toBe(200);
            expect(body.types.find((t: TAny) => t.name === 'Character')).toMatchObject({
                file: 'types/Character.ts',
                kind: 'class',
                origin: 'extendable',
            });
            expect(body.types.find((t: TAny) => t.name === 'TCharacter')).toBeUndefined();
            expect(await readFile(project.abs('types/Location.ts'), 'utf8')).toBe(
                await readFile(path.join(EXAMPLE_STORY_ROOT, 'types/Location.ts'), 'utf8')
            );
        } finally {
            await app.close();
        }
    }, 60_000);
});
