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

const TEMPLATE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../template');

const TEMPLATE_DIRS = ['data', 'types'];

const storyTsconfig = (storyDir: string): Promise<string> => {
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
        exclude: ['data/__tests__', 'data/assets', 'node_modules'],
    };
    return formatJson(config);
};

export const slugify = (name: string): string =>
    name
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '') // combining accents
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+/, '')
        .slice(0, 64)
        .replace(/-+$/, '') || 'story';

const exists = async (file: string) => (await lstat(file).catch(() => null)) !== null;

const freeId = async (stories: StoryStore, slug: string): Promise<string> => {
    for (let n = 1; ; n++) {
        const suffix = n === 1 ? '' : `-${n}`;
        const id = slug.slice(0, 64 - suffix.length).replace(/-+$/, '') + suffix;
        if (isStoryId(id) && !(await exists(stories.dir(id)))) return id;
    }
};

// a dot name is never a story id, so nobody lists or loads it half-built
const tempDir = (stories: StoryStore, kind: string) =>
    path.join(stories.root, `.${kind}-${randomBytes(6).toString('hex')}`);

const writeInto = async (dir: string, rel: string, contents: string | Uint8Array) => {
    const file = path.join(dir, ...rel.split('/'));
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, contents);
};

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

export const importStoryFolder = async (stories: StoryStore, id: string, files: Map<string, Uint8Array>) => {
    const dir = stories.dir(id);
    const taken = () => HttpError.exists(`A story "${id}" already exists; import it under another id`);
    if (await exists(dir)) throw taken(); // fail fast, before writing anything
    const tmp = tempDir(stories, 'import');
    try {
        await mkdir(tmp);
        for (const [rel, bytes] of files) await writeInto(tmp, rel, bytes);
        // the zip's own tsconfig may point at another checkout's engine
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
