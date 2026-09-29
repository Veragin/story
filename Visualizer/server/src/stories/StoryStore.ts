import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { isStoryId, type TMapSizeDto, type TStoryDto, type TVersion } from '@story/visualizer-protocol';
import { version } from '../events/version';
import { atomicWrite } from '../json/atomicWrite';
import { formatJson } from '../json/format';
import { DEFAULT_STORIES_ROOT, REPO_ROOT } from '../project/ProjectRoot';

/** The file next to a story's `data/` and `types/`. */
export const STORY_FILE = 'story.json';

/**
 * `stories/<id>/story.json` as it is on disk. `password` is a self-describing hash
 * (`scrypt$N$r$p$salt$hash`, plan D1): it never leaves the server, clients get `TStoryDto`.
 */
export type TStoryFile = {
    name: string;
    author: string;
    password: string;
    mapSize: TMapSizeDto;
    description: string;
    public: boolean;
};

const isPositiveInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v > 0;

/** Check a parsed `story.json`. Throws an `Error` naming the first bad field. */
export const parseStoryFile = (value: unknown): TStoryFile => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new Error('story.json must hold an object');
    }
    const v = value as Record<string, unknown>;
    for (const key of ['name', 'author', 'password', 'description'] as const) {
        if (typeof v[key] !== 'string') throw new Error(`story.json: "${key}" must be a string`);
    }
    if (typeof v.public !== 'boolean') throw new Error('story.json: "public" must be a boolean');
    const mapSize = v.mapSize as Record<string, unknown> | null | undefined;
    if (
        typeof mapSize !== 'object' ||
        mapSize === null ||
        !isPositiveInt(mapSize.width) ||
        !isPositiveInt(mapSize.height)
    ) {
        throw new Error('story.json: "mapSize" must be { width, height } in whole tiles');
    }
    return {
        name: v.name as string,
        author: v.author as string,
        password: v.password as string,
        mapSize: { width: mapSize.width, height: mapSize.height },
        description: v.description as string,
        public: v.public,
    };
};

/** The text of a `story.json`, checked and formatted like every JSON file the server writes. */
export const storyFileText = (file: TStoryFile): Promise<string> => formatJson(parseStoryFile(file));

/** What a client may see of a story: everything but the password hash. */
export const toStoryDto = (id: string, file: TStoryFile): TStoryDto => ({
    id,
    name: file.name,
    author: file.author,
    description: file.description,
    mapSize: { ...file.mapSize },
    public: file.public,
});

/**
 * The story registry: every folder of `STORIES_ROOT` that holds a `story.json` is a story, and the
 * folder name is its id (plan D3). This class reads and writes only `story.json`; the story's
 * `data/` and `types/` are its `ProjectRoot`'s (`StoryContexts`).
 */
export class StoryStore {
    readonly root: string;
    /** Tail of the `exclusive` queue. */
    private queue: Promise<unknown> = Promise.resolve();

    constructor(root: string) {
        this.root = path.resolve(root);
    }

    /**
     * `STORIES_ROOT`, else `<repo>/stories`. A relative path is resolved against the repo root,
     * not the working directory: `yarn workspace … dev` runs in `Visualizer/server/`, and
     * `STORIES_ROOT=stories` should mean the same thing however the server was started.
     */
    static fromEnv(env: NodeJS.ProcessEnv = process.env): StoryStore {
        const configured = env.STORIES_ROOT?.trim();
        return new StoryStore(configured ? path.resolve(REPO_ROOT, configured) : DEFAULT_STORIES_ROOT);
    }

    /** The folder of a story. Throws on a malformed id, so an id from a URL cannot leave the root. */
    dir(storyId: string): string {
        if (!isStoryId(storyId)) throw new Error(`Not a story id: ${JSON.stringify(storyId)}`);
        return path.join(this.root, storyId);
    }

    /** Whether `storyId` is a well-formed id with a `story.json` (not whether that file is valid). */
    async exists(storyId: string): Promise<boolean> {
        if (!isStoryId(storyId)) return false;
        try {
            return (await stat(path.join(this.dir(storyId), STORY_FILE))).isFile();
        } catch {
            return false;
        }
    }

    /** A story's `story.json`, validated; `null` when there is no such story. Throws when it is invalid. */
    async read(storyId: string): Promise<TStoryFile | null> {
        return (await this.readVersioned(storyId))?.file ?? null;
    }

    /**
     * `read`, plus the file's `version` (the hash of its text, like every other resource), for the
     * versioned `GET/PUT /info`.
     */
    async readVersioned(storyId: string): Promise<{ file: TStoryFile; version: TVersion } | null> {
        if (!isStoryId(storyId)) return null;
        let text: string;
        try {
            text = await readFile(path.join(this.dir(storyId), STORY_FILE), 'utf8');
        } catch (e) {
            if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
            throw e;
        }
        return { file: parseStoryFile(JSON.parse(text)), version: version(text) };
    }

    /**
     * Replace a story's `story.json` atomically, formatted like every JSON file the server writes.
     * Returns its new version.
     */
    async write(storyId: string, file: TStoryFile): Promise<TVersion> {
        const text = await storyFileText(file);
        await atomicWrite(path.join(this.dir(storyId), STORY_FILE), text);
        return version(text);
    }

    /**
     * Run `fn` alone: one at a time for the whole store. Everything that adds a story folder
     * (create, import: the id must still be free when the folder is renamed into place) or
     * rewrites a `story.json` (read, check the version, write) goes through here. They are rare,
     * so one queue is enough.
     */
    exclusive<T>(fn: () => Promise<T>): Promise<T> {
        const result = this.queue.then(fn, fn);
        this.queue = result.catch(() => undefined);
        return result;
    }

    /**
     * Every story, sorted by name (then id). A folder whose `story.json` is unreadable or invalid is
     * skipped with a warning, so one broken story does not hide the others.
     */
    async list(): Promise<{ id: string; file: TStoryFile }[]> {
        let entries;
        try {
            entries = await readdir(this.root, { withFileTypes: true });
        } catch (e) {
            if ((e as NodeJS.ErrnoException).code === 'ENOENT') return [];
            throw e;
        }
        const stories: { id: string; file: TStoryFile }[] = [];
        for (const entry of entries) {
            if (!entry.isDirectory() || !isStoryId(entry.name)) continue;
            try {
                const file = await this.read(entry.name);
                if (file) stories.push({ id: entry.name, file });
            } catch (e) {
                console.warn(`[visualizer-server] skipping story "${entry.name}": ${(e as Error).message}`);
            }
        }
        return stories.sort((a, b) => a.file.name.localeCompare(b.file.name) || a.id.localeCompare(b.id));
    }
}
