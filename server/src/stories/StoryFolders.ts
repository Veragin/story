import { randomBytes } from 'node:crypto';
import { cp, mkdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Inject, Injectable } from '@nestjs/common';
import { GLOBAL_MAP_ID, isStoryId, type TMapSizeDto } from '@story/protocol';
import type { EntityManager } from 'typeorm';
import { exists } from '../common/fileStat';
import { atomicWrite } from '../json/atomicWrite';
import { createDefaultMap, encodeMapFile, MAP_FILE } from '../json/mapFile';
import { STORIES_ROOT } from './storiesRoot';
import type { TStoryFile } from './storyFile';
import { STORY_TOP_FILES } from './storyFiles';
import { StoryRepository } from '../database/repositories/StoryRepository';
import { storyTsconfig } from './storyTsconfig';
import { TEMPLATE_ROOT } from './templateRoot';
import { zipStory } from './zip';

const TEMPLATE_DIRS = ['data', 'types'];

const STORY_ID_MAX_LENGTH = 64;

export const slugify = (name: string): string =>
    name
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '') // combining accents
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+/, '')
        .slice(0, STORY_ID_MAX_LENGTH)
        .replace(/-+$/, '') || 'story';

const writeInto = async (dir: string, rel: string, contents: string | Uint8Array) => {
    const file = path.join(dir, ...rel.split('/'));
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, contents);
};

const defaultMap = ({ width, height }: TMapSizeDto, title?: string) =>
    createDefaultMap(GLOBAL_MAP_ID, { title, width, height });

const encodeText = (text: string) => new TextEncoder().encode(text);

@Injectable()
export class StoryFolders {
    private queue: Promise<void> = Promise.resolve();

    constructor(
        @Inject(STORIES_ROOT) readonly root: string,
        private readonly stories: StoryRepository
    ) {}

    dir(storyId: string): string {
        if (!isStoryId(storyId)) throw new Error(`Not a story id: ${JSON.stringify(storyId)}`);
        return path.join(this.root, storyId);
    }

    create(file: TStoryFile): Promise<string> {
        return this.place('create', file, async (tmp) => {
            for (const name of TEMPLATE_DIRS) {
                await cp(path.join(TEMPLATE_ROOT, name), path.join(tmp, name), { recursive: true });
            }
            await writeInto(tmp, MAP_FILE, await encodeMapFile(defaultMap(file.mapSize, 'World')));
        });
    }

    import(file: TStoryFile, files: ReadonlyMap<string, Uint8Array>): Promise<string> {
        return this.place('import', file, async (tmp) => {
            for (const [rel, bytes] of files) await writeInto(tmp, rel, bytes);
        });
    }

    // the story keeps its own tsconfig.json: the zip's may point elsewhere
    async addFiles(storyId: string, files: ReadonlyMap<string, Uint8Array>): Promise<void> {
        const dir = this.dir(storyId);
        for (const [rel, bytes] of files) {
            if (!STORY_TOP_FILES.includes(rel)) await atomicWrite(path.join(dir, ...rel.split('/')), bytes);
        }
    }

    // a story without a map.json shows the default map, so the zip carries that one
    async exportZip(storyId: string, mapSize: TMapSizeDto): Promise<Uint8Array> {
        const dir = this.dir(storyId);
        const added = new Map<string, Uint8Array>();
        if (!(await exists(path.join(dir, MAP_FILE)))) {
            added.set(MAP_FILE, encodeText(await encodeMapFile(defaultMap(mapSize))));
        }
        return zipStory(dir, added);
    }

    // a dot name is never a story id, so nobody lists or loads it half-built
    async makeTemp(kind: string): Promise<string> {
        await mkdir(this.root, { recursive: true });
        const tmp = path.join(this.root, `.${kind}-${randomBytes(6).toString('hex')}`);
        await mkdir(tmp);
        return tmp;
    }

    // the old folder comes back if the new one cannot take its name
    async replace(storyId: string, tmp: string): Promise<void> {
        const dir = this.dir(storyId);
        const old = path.join(this.root, `.replace-${randomBytes(6).toString('hex')}`);
        await rename(dir, old);
        try {
            await rename(tmp, dir);
        } catch (e) {
            await rename(old, dir);
            throw e;
        }
        await rm(old, { recursive: true, force: true });
    }

    private async place(kind: string, file: TStoryFile, fill: (tmp: string) => Promise<void>): Promise<string> {
        const tmp = await this.makeTemp(kind);
        try {
            await fill(tmp);
            // a sibling of the final folder, so the relative engine paths are the same; the zip's own may point elsewhere
            await writeInto(tmp, 'tsconfig.json', await storyTsconfig(tmp));
            return await this.serialized(() => this.commit(tmp, file));
        } finally {
            await rm(tmp, { recursive: true, force: true });
        }
    }

    // row and folder appear together: the rename runs inside the insert's transaction
    private async commit(tmp: string, file: TStoryFile): Promise<string> {
        const placed: string[] = [];
        try {
            return await this.stories.exclusive(async (manager) => {
                const id = await this.freeId(slugify(file.name), manager);
                await this.stories.insert(id, file, manager);
                await rename(tmp, this.dir(id));
                placed.push(this.dir(id));
                return id;
            });
        } catch (e) {
            for (const dir of placed) await rm(dir, { recursive: true, force: true });
            throw e;
        }
    }

    private async freeId(slug: string, manager: EntityManager): Promise<string> {
        for (let n = 1; ; n++) {
            const suffix = n === 1 ? '' : `-${n}`;
            const id = slug.slice(0, STORY_ID_MAX_LENGTH - suffix.length).replace(/-+$/, '') + suffix;
            if (isStoryId(id) && !(await this.stories.exists(id, manager)) && !(await exists(this.dir(id)))) return id;
        }
    }

    // one id at a time: two stories of the same name must not both pick the same free id
    private async serialized<T>(fn: () => Promise<T>): Promise<T> {
        const previous = this.queue;
        let release = () => {};
        this.queue = new Promise<void>((resolve) => {
            release = resolve;
        });
        try {
            await previous;
            return await fn();
        } finally {
            release();
        }
    }
}
