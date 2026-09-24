import { cp, mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SourceFileService } from '../src/story/SourceFileService';

/**
 * A throwaway copy of the story, for the writer tests (VISUALIZER_PLAN §7, Phase 5: "Tested
 * against a fixture story copied to a temp dir, asserting on the resulting file text").
 *
 * The writers mutate `data/` and `types/`. Pointing them at the real repo would mean a failing
 * test leaves the story edited — and a *passing* test still rewrites files git is tracking. So
 * each test gets its own temp repo: a `package.json` with `workspaces` (which is how
 * `SourceFileService` locates a repo root), a `.prettierrc` copied from the real one (so
 * formatting assertions are about the repo's config, not Prettier's defaults), and a `data/`
 * and `types/` tree.
 *
 * The fixture is written by hand rather than copied wholesale from `data/`, so the tests do not
 * change meaning when the story does — a test that asserts on "the village chapter's title"
 * should not start failing because an author renamed it.
 */

export type TFixture = {
    root: string;
    files: SourceFileService;
    /** Absolute path of a repo-relative file. */
    at: (repoRelative: string) => string;
    cleanup: () => Promise<void>;
};

export const createFixture = async (): Promise<TFixture> => {
    const root = await mkdtemp(join(tmpdir(), 'visualizer-fixture-'));

    await writeFile(
        join(root, 'package.json'),
        JSON.stringify({ name: 'fixture-root', private: true, workspaces: ['data', 'types'] }, null, 4),
        'utf8'
    );

    // The real Prettier config, so "formatted as `yarn pretty` would" is literally what is
    // asserted — including the `printWidth: 120` override for `.ts`, which is the one that
    // would otherwise make every generated line wrap 40 characters early.
    await cp(new URL('../../../.prettierrc', import.meta.url).pathname, join(root, '.prettierrc'));

    await mkdir(join(root, 'data/locations'), { recursive: true });
    await mkdir(join(root, 'data/maps'), { recursive: true });
    await mkdir(join(root, 'data/chapters/village'), { recursive: true });
    await mkdir(join(root, 'types'), { recursive: true });

    await writeFile(join(root, 'data/register.ts'), REGISTER, 'utf8');
    await writeFile(join(root, 'data/locations/village.location.ts'), VILLAGE_LOCATION, 'utf8');
    await writeFile(join(root, 'data/locations/kingdom.location.ts'), KINGDOM_LOCATION, 'utf8');
    await writeFile(join(root, 'data/maps/global.map.ts'), GLOBAL_MAP, 'utf8');
    await writeFile(join(root, 'data/chapters/village/village.chapter.ts'), VILLAGE_CHAPTER, 'utf8');
    await writeFile(join(root, 'data/chapters/village/intro.screen.ts'), INTRO_PASSAGE, 'utf8');
    await writeFile(join(root, 'types/TLocation.ts'), 'export type TLocation = { id: string };\n', 'utf8');

    // `SourceFileService` finds the repo root by climbing from its own module URL, which in a
    // test is the real repo. Overriding the resolved root is the one seam it needs to be
    // testable at all, and it is done by construction rather than by an env var so two fixtures
    // can exist at once.
    const files = new SourceFileService();
    Object.defineProperty(files, 'repoRoot', { value: root, writable: false, configurable: true });
    Object.defineProperty(files, 'allowedRoots', {
        value: [join(root, 'data'), join(root, 'types')],
        writable: false,
        configurable: true,
    });

    return {
        root,
        files,
        at: (repoRelative: string) => join(root, repoRelative),
        cleanup: () => rm(root, { recursive: true, force: true }),
    };
};

/* ------------------------------------------------------------------ contents */

/**
 * Every fixture file carries a comment, a blank line, and something after the export — because
 * what the writer tests actually assert is that *those survive*. A fixture that is only an
 * object literal could not fail the test it exists for.
 */

const REGISTER = `import { villageLocation } from './locations/village.location';
import { kingdomLocation } from './locations/kingdom.location';
import { globalMap } from './maps/global.map';
import { villageChapter } from './chapters/village/village.chapter';

export const register = {
    chapters: {
        village: villageChapter,
    },
    locations: {
        village: villageLocation,
        kingdom: kingdomLocation,
    },
    maps: {
        global: globalMap,
    },
    passages: {
        village: () => import('./chapters/village/village.passages'),
    },
} as const;
`;

const VILLAGE_LOCATION = `import { TLocation } from '@story/types';

/** The village. This comment must survive every write. */
export const villageLocation: TLocation<'village'> = {
    id: 'village',
    name: 'Village',
    description: 'A small place.',

    localCharacters: [],

    shape: {
        mapId: 'global',
        points: [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
            { x: 100, y: 100 },
        ],
        color: '#2e9e5b',
    },

    init: {},
};

export type TVillageLocationData = {
    mojePromena: number;
};
`;

const KINGDOM_LOCATION = `import { TLocation } from '@story/types';

export const kingdomLocation: TLocation<'kingdom'> = {
    id: 'kingdom',
    name: 'Kingdom',
    description: '',

    localCharacters: [],

    init: {},
};
`;

const GLOBAL_MAP = `import { TMap } from '@story/types';

/** The world map. */
export const globalMap: TMap<'global'> = {
    id: 'global',
    title: 'The Kingdom',

    size: { width: 2000, height: 1400 },

    notes: [],

    strokes: [],
};
`;

const VILLAGE_CHAPTER = `import { Time } from '@story/shared';
import { TChapter } from '@story/types';

export const villageChapter: TChapter<'village'> = {
    chapterId: 'village',
    title: 'Village Chapter',
    description: 'A village chapter is happening',
    timeRange: {
        start: Time.fromString('2.1. 8:00'),
        end: Time.fromString('5.1. 8:00'),
    },
    location: 'village',

    children: [],

    triggers: [],

    init: {},
};

export type TVillageChapterData = {
    mojePromena: number;
};
`;

/** A passage — a *function*, which is what the writer must refuse to edit (§4.5 rule 2). */
const INTRO_PASSAGE = `import { TPassageScreen } from '@story/types';

export const introPassage = (): TPassageScreen<'village', 'thomas', string> => ({
    chapterId: 'village',
    characterId: 'thomas',
    id: 'intro',
    type: 'screen',
    title: 'Intro',
    body: [
        {
            condition: true,
            text: 'text',
            links: [{ text: 'Go', passageId: 'village-thomas-forest' }],
        },
    ],
});
`;
