import { randomBytes } from 'node:crypto';
import { cp, lstat, mkdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GLOBAL_MAP_ID, isStoryId, type TMapSizeDto } from '@story/visualizer-protocol';
import { HttpError } from '../http/HttpError';
import { formatJson } from '../json/format';
import { createDefaultMap, encodeMapFile } from '../json/mapStore';
import { REPO_ROOT } from '../project/ProjectRoot';
import { STORY_FILE, storyFileText, type StoryStore, type TStoryFile } from './StoryStore';

/**
 * Making story folders (multiple stories, phase 5): create one from the template, or from an
 * imported zip. Both build the folder under a temp name in `STORIES_ROOT` (same filesystem, and
 * a name that is not a story id, so no one lists or loads it half-built) and then `rename` it
 * into place inside `StoryStore.exclusive`, so the id is still free at that moment and a story
 * appears whole or not at all.
 */

/**
 * `Visualizer/server/template/`: the smallest story that type-checks and plays (one chapter, one
 * character with one passage, one location, one npc, one item). An empty story is not enough:
 * empty id unions collapse to `never` and break the types. Engine-owned, not a story: it is
 * not under `STORIES_ROOT`, and it has its own `tsconfig.json` (checked by
 * `scripts/typecheck-stories.mjs`), which is not copied (`storyTsconfig` writes the story's).
 */
export const TEMPLATE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../template');

/** What is copied from the template into a new story. */
const TEMPLATE_DIRS = ['data', 'types'];

/**
 * The `tsconfig.json` of a story folder: the example's shape (`stories/example/tsconfig.json`),
 * with `@story/types` / `@story/data` pointing at the story's own folders and the engine packages
 * at this repo. The engine paths are relative to the folder, so it is written for where the story
 * lives (on create, and again on import: a zip's own copy may come from another checkout).
 */
export const storyTsconfig = (storyDir: string): Promise<string> => {
    const repo = path.relative(storyDir, REPO_ROOT).split(path.sep).join('/') || '.';
    const config = {
        extends: `${repo}/tsconfig.base.json`,
        compilerOptions: {
            baseUrl: '.',
            paths: {
                '@story/types': ['types/index.ts'],
                '@story/data': ['data/index.ts'],
                '@story/data/*': ['data/*'],
                '@story/core': [`${repo}/core/src/index.ts`],
                '@story/shared': [`${repo}/shared/src/index.ts`],
                '@story/ui': [`${repo}/ui/src/index.ts`],
            },
        },
        include: ['data', 'types'],
        exclude: ['data/test', 'data/assets', 'node_modules'],
    };
    return formatJson(config);
};

/**
 * The id of a story named `name` (plan D3): lowercase ASCII letters and digits, anything else
 * becomes `-` (accents are dropped first: `Příběh` → `pribeh`), at most 64 characters. A name
 * with nothing left (`!!!`, `故事`) gives `story`.
 */
export const slugify = (name: string): string =>
    name
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+/, '')
        .slice(0, 64)
        .replace(/-+$/, '') || 'story';

const exists = async (file: string) => (await lstat(file).catch(() => null)) !== null;

/** `slug`, else `slug-2`, `slug-3`, … — the first one no folder in the root has. */
const freeId = async (stories: StoryStore, slug: string): Promise<string> => {
    for (let n = 1; ; n++) {
        const suffix = n === 1 ? '' : `-${n}`;
        const id = slug.slice(0, 64 - suffix.length).replace(/-+$/, '') + suffix;
        if (isStoryId(id) && !(await exists(stories.dir(id)))) return id;
    }
};

/** A fresh temp folder name inside the stories root (a dot name: never a story id). */
const tempDir = (stories: StoryStore, kind: string) =>
    path.join(stories.root, `.${kind}-${randomBytes(6).toString('hex')}`);

const writeInto = async (dir: string, rel: string, contents: string | Uint8Array) => {
    const file = path.join(dir, ...rel.split('/'));
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, contents);
};

/**
 * Create a story from the template: its `data/` and `types/`, then `story.json`, a
 * `tsconfig.json` for its folder, and an empty `data/locations/map.json` of `mapSize` (plan D6).
 * The id is a slug of the name, with a numeric suffix when taken. Returns the id.
 */
export const createStoryFolder = (stories: StoryStore, file: TStoryFile): Promise<string> =>
    stories.exclusive(async () => {
        const id = await freeId(stories, slugify(file.name));
        const dir = stories.dir(id);
        const tmp = tempDir(stories, 'create');
        try {
            for (const name of TEMPLATE_DIRS) {
                await cp(path.join(TEMPLATE_ROOT, name), path.join(tmp, name), { recursive: true });
            }
            await writeInto(tmp, STORY_FILE, await storyFileText(file));
            await writeInto(tmp, 'tsconfig.json', await storyTsconfig(dir));
            await writeInto(tmp, 'data/locations/map.json', await encodeMapFile(emptyMap(file.mapSize)));
            await rename(tmp, dir);
        } catch (e) {
            await rm(tmp, { recursive: true, force: true });
            throw e;
        }
        return id;
    });

const emptyMap = ({ width, height }: TMapSizeDto) => createDefaultMap(GLOBAL_MAP_ID, { title: 'World', width, height });

/**
 * Put an unpacked story zip (`zip.ts#unzipStory`, `story.json` already validated) in place as
 * story `id`: `409 exists` when the id is taken (plan D8). The zip's `story.json` is kept as it
 * is, password hash included; its `tsconfig.json` is replaced by one for this folder.
 */
export const importStoryFolder = async (stories: StoryStore, id: string, files: Map<string, Uint8Array>) => {
    const dir = stories.dir(id);
    const taken = () => HttpError.exists(`A story "${id}" already exists; import it under another id`);
    if (await exists(dir)) throw taken(); // fail fast, before writing anything
    const tmp = tempDir(stories, 'import');
    try {
        await mkdir(tmp);
        for (const [rel, bytes] of files) await writeInto(tmp, rel, bytes);
        await writeInto(tmp, 'tsconfig.json', await storyTsconfig(dir));
        await stories.exclusive(async () => {
            if (await exists(dir)) throw taken();
            await rename(tmp, dir);
        });
    } catch (e) {
        await rm(tmp, { recursive: true, force: true });
        throw e;
    }
};
