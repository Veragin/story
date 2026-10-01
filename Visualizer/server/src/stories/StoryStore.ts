import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { isStoryId, type TMapSizeDto, type TStoryDto, type TVersion } from '@story/visualizer-protocol';
import { version } from '../events/version';
import { errorMessage } from '../http/HttpError';
import { isPlainObject } from '../http/body';
import { atomicWrite, isMissingFileError } from '../json/atomicWrite';
import { formatJson } from '../json/format';
import { DEFAULT_STORIES_ROOT, REPO_ROOT } from '../project/ProjectRoot';

export const STORY_FILE = 'story.json';

export type TStoryFile = {
    name: string;
    author: string;
    password: string;
    mapSize: TMapSizeDto;
    description: string;
    public: boolean;
};

const isPositiveInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v > 0;

const stringField = (v: Record<string, unknown>, key: string): string => {
    const field = v[key];
    if (typeof field !== 'string') throw new Error(`story.json: "${key}" must be a string`);
    return field;
};

export const parseStoryFile = (value: unknown): TStoryFile => {
    if (!isPlainObject(value)) throw new Error('story.json must hold an object');
    const name = stringField(value, 'name');
    const author = stringField(value, 'author');
    const password = stringField(value, 'password');
    const description = stringField(value, 'description');
    if (typeof value.public !== 'boolean') throw new Error('story.json: "public" must be a boolean');
    const { mapSize } = value;
    if (!isPlainObject(mapSize) || !isPositiveInt(mapSize.width) || !isPositiveInt(mapSize.height)) {
        throw new Error('story.json: "mapSize" must be { width, height } in whole tiles');
    }
    return {
        name,
        author,
        password,
        mapSize: { width: mapSize.width, height: mapSize.height },
        description,
        public: value.public,
    };
};

export const storyFileText = (file: TStoryFile): Promise<string> => formatJson(parseStoryFile(file));

export const toStoryDto = (id: string, file: TStoryFile): TStoryDto => ({
    id,
    name: file.name,
    author: file.author,
    description: file.description,
    mapSize: { ...file.mapSize },
    public: file.public,
});

export class StoryStore {
    readonly root: string;
    private queue: Promise<unknown> = Promise.resolve();

    constructor(root: string) {
        this.root = path.resolve(root);
    }

    // relative to the repo root, not cwd: `yarn workspace … dev` runs in Visualizer/server
    static fromEnv(env: NodeJS.ProcessEnv = process.env): StoryStore {
        const configured = env.STORIES_ROOT?.trim();
        return new StoryStore(configured ? path.resolve(REPO_ROOT, configured) : DEFAULT_STORIES_ROOT);
    }

    dir(storyId: string): string {
        if (!isStoryId(storyId)) throw new Error(`Not a story id: ${JSON.stringify(storyId)}`);
        return path.join(this.root, storyId);
    }

    async exists(storyId: string): Promise<boolean> {
        if (!isStoryId(storyId)) return false;
        try {
            return (await stat(path.join(this.dir(storyId), STORY_FILE))).isFile();
        } catch {
            return false;
        }
    }

    async read(storyId: string): Promise<TStoryFile | null> {
        return (await this.readVersioned(storyId))?.file ?? null;
    }

    async readVersioned(storyId: string): Promise<{ file: TStoryFile; version: TVersion } | null> {
        if (!isStoryId(storyId)) return null;
        let text: string;
        try {
            text = await readFile(path.join(this.dir(storyId), STORY_FILE), 'utf8');
        } catch (e) {
            if (isMissingFileError(e)) return null;
            throw e;
        }
        return { file: parseStoryFile(JSON.parse(text)), version: version(text) };
    }

    async write(storyId: string, file: TStoryFile): Promise<TVersion> {
        const text = await storyFileText(file);
        await atomicWrite(path.join(this.dir(storyId), STORY_FILE), text);
        return version(text);
    }

    exclusive<T>(fn: () => Promise<T>): Promise<T> {
        const result = this.queue.then(fn, fn);
        this.queue = result.catch(() => undefined);
        return result;
    }

    async list(): Promise<{ id: string; file: TStoryFile }[]> {
        let entries;
        try {
            entries = await readdir(this.root, { withFileTypes: true });
        } catch (e) {
            if (isMissingFileError(e)) return [];
            throw e;
        }
        const stories: { id: string; file: TStoryFile }[] = [];
        for (const entry of entries) {
            if (!entry.isDirectory() || !isStoryId(entry.name)) continue;
            try {
                const file = await this.read(entry.name);
                if (file) stories.push({ id: entry.name, file });
            } catch (e) {
                console.warn(`[visualizer-server] skipping story "${entry.name}": ${errorMessage(e)}`);
            }
        }
        return stories.sort((a, b) => a.file.name.localeCompare(b.file.name) || a.id.localeCompare(b.id));
    }
}
