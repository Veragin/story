import { Injectable } from '@nestjs/common';
import { register } from '@story/data';
import type { TPoint, TSize } from '@story/shared';
import { PassageIndexer } from './PassageIndexer';
import { SourceFileService } from './SourceFileService';
import type {
    TChapterSummary,
    TCharacterSummary,
    TLocationSummary,
    TMapSummary,
    TPassageSummary,
    TStoryIndex,
    TTriggerSummary,
} from './types';

/**
 * Minimal structural views of the author's entries.
 *
 * Not `TChapter<'village'>` and friends, and the reason is variance rather than laziness: those
 * types are parameterised by their own id and reference `TWorldState` slices through it, so
 * `TChapter<'village'>` is not assignable to any common supertype — there is no `TChapter<any>`
 * that a heterogeneous `Object.entries` can produce. Reading through the handful of fields the
 * API actually projects keeps the reader honest about what it depends on, and means adding a
 * field to `TChapter` cannot silently change what the wire carries.
 */
type TChapterEntry = {
    title: string;
    description: string;
    location?: string;
    timeRange?: { start: { s: number }; end: { s: number } };
    children?: { chapter: { chapterId: string } }[];
    triggers?: unknown[];
    layout?: Record<string, TPoint>;
};

type TLocationEntry = {
    name: string;
    description: string;
    localCharacters?: unknown[];
    shape?: { mapId: string; points: TPoint[]; color: string; z?: number };
};

type TMapEntry = {
    title: string;
    size: TSize;
    background?: { asset: string; position: TPoint; size: TSize };
    notes?: { id: string; text: string; position: TPoint; rotation?: number; color?: string }[];
    strokes?: { id: string; color: string; width: number; points: number[] }[];
    maps?: { mapId: string; position: TPoint }[];
};

type TCharacterEntry = { id: string; name?: string; startPassageId?: string };

/** The register, viewed structurally. One cast, in one place, rather than at each read. */
const story = register as unknown as {
    chapters: Record<string, TChapterEntry>;
    locations: Record<string, TLocationEntry>;
    maps?: Record<string, TMapEntry>;
    characters: Record<string, TCharacterEntry>;
    sideCharacters: Record<string, TCharacterEntry>;
};

/**
 * The read model: the story as the API sees it (VISUALIZER_PLAN §5.1).
 *
 * ## Hybrid, and why
 *
 * §5.1 describes a "ts-morph index of `data/` + `types/`". What is built here is a hybrid, and
 * the split is along the line §5.1 itself draws:
 *
 *  - **Chapters, locations, maps and characters are imported.** They are plain object literals,
 *    the server already has `@story/data` on its dependency list for exactly this ("the server
 *    may still import `{ register }` from `@story/data` for read-only metadata"), and the
 *    imported value is by definition what the story actually says. Re-deriving a chapter title
 *    from source text would be strictly less accurate and considerably more code.
 *  - **Passages are parsed** (`PassageIndexer`), because they are functions of `(s, e)` and
 *    reading them any other way means running the story.
 *
 * File paths and hashes come from disk either way, because an imported object does not know
 * which file it was written in — and `file` is what `POST …/open` needs and `hash` is what
 * `If-Match` compares.
 *
 * ## Caching
 *
 * The index is built once and kept. `invalidate()` drops it; the watcher calls that on any
 * change under `data/` or `types/`, and the next request rebuilds. A rebuild is milliseconds
 * for a story this size, so there is no partial-invalidation machinery — that would be a cache
 * coherency problem in exchange for a saving nobody can perceive.
 *
 * The *imported* half cannot be invalidated at all: ESM module records are immutable for a
 * process's lifetime, so an edit to `data/chapters/…` does not change `register` until the
 * server restarts. That is a real limitation and it is why `--watch` is in the dev script — the
 * server restarts on any source change under its own tree, and the same file change also
 * triggers the client's HMR. Writes go through ts-morph and read back from disk, so a value the
 * *server itself* wrote is never served stale.
 */
@Injectable()
export class StoryIndexService {
    private readonly passageIndexer = new PassageIndexer();
    private cached: TStoryIndex | null = null;

    constructor(private readonly files: SourceFileService) {}

    /** Drops the cache. Called by the file watcher; safe to call at any time. */
    invalidate(): void {
        this.cached = null;
    }

    async getIndex(): Promise<TStoryIndex> {
        if (!this.cached) this.cached = await this.build();
        return this.cached;
    }

    async getChapters(): Promise<TChapterSummary[]> {
        return (await this.getIndex()).chapters;
    }

    async getChapter(id: string): Promise<TChapterSummary | undefined> {
        return (await this.getChapters()).find((chapter) => chapter.id === id);
    }

    async getPassages(): Promise<TPassageSummary[]> {
        return (await this.getIndex()).passages;
    }

    async getPassage(id: string): Promise<TPassageSummary | undefined> {
        return (await this.getPassages()).find((passage) => passage.id === id);
    }

    async getLocations(): Promise<TLocationSummary[]> {
        return (await this.getIndex()).locations;
    }

    async getLocation(id: string): Promise<TLocationSummary | undefined> {
        return (await this.getLocations()).find((location) => location.id === id);
    }

    async getMaps(): Promise<TMapSummary[]> {
        return (await this.getIndex()).maps;
    }

    async getMap(id: string): Promise<TMapSummary | undefined> {
        return (await this.getMaps()).find((map) => map.id === id);
    }

    async getCharacters(): Promise<TCharacterSummary[]> {
        return (await this.getIndex()).characters;
    }

    /* ------------------------------------------------------------- building */

    private async build(): Promise<TStoryIndex> {
        const [chapters, locations, maps, characters, passages] = await Promise.all([
            this.buildChapters(),
            this.buildLocations(),
            this.buildMaps(),
            this.buildCharacters(),
            this.buildPassages(),
        ]);

        const triggers = chapters.flatMap((chapter) => this.buildTriggers(chapter.id));

        // Denormalise: which locations sit on which map. The map tab is one request this way
        // rather than one per location.
        const byMap = new Map<string, string[]>();
        for (const location of locations) {
            if (!location.shape) continue;
            const list = byMap.get(location.shape.mapId);
            if (list) list.push(location.id);
            else byMap.set(location.shape.mapId, [location.id]);
        }
        for (const map of maps) {
            map.locationIds = byMap.get(map.id) ?? [];
        }

        return { chapters, passages, locations, maps, characters, triggers };
    }

    private async buildChapters(): Promise<TChapterSummary[]> {
        const entries = Object.entries(story.chapters);

        return await Promise.all(
            entries.map(async ([id, chapter]) => {
                const file = await this.findFile(`data/chapters/${id}`, `${id}.chapter.ts`);
                return {
                    id,
                    title: chapter.title,
                    description: chapter.description,
                    locationId: chapter.location ?? null,
                    timeRange: chapter.timeRange
                        ? { start: chapter.timeRange.start.s, end: chapter.timeRange.end.s }
                        : null,
                    // Ids only — the nested `TChapter` objects would duplicate the whole graph
                    // into every response.
                    childChapterIds: (chapter.children ?? []).map((child) => child.chapter.chapterId),
                    triggerIds: (chapter.triggers ?? []).map((trigger, index) => triggerId(id, trigger, index)),
                    layout: chapter.layout ?? {},
                    file,
                    hash: file ? await this.files.hashOf(file) : null,
                } satisfies TChapterSummary;
            })
        );
    }

    private buildTriggers(chapterId: string): TTriggerSummary[] {
        const chapter = story.chapters[chapterId];
        return (chapter?.triggers ?? []).map((trigger, index) => {
            const raw = trigger as unknown as { title?: string; name?: string; time?: { s?: number } };
            return {
                id: triggerId(chapterId, trigger, index),
                chapterId,
                title: raw.title ?? raw.name ?? null,
                time: raw.time?.s ?? null,
            };
        });
    }

    private async buildLocations(): Promise<TLocationSummary[]> {
        const entries = Object.entries(story.locations);

        return await Promise.all(
            entries.map(async ([id, location]) => {
                const file = await this.findFile('data/locations', `${id}.location.ts`);
                return {
                    id,
                    name: location.name,
                    description: location.description,
                    localCharacterCount: location.localCharacters?.length ?? 0,
                    shape: location.shape
                        ? {
                              mapId: location.shape.mapId,
                              points: location.shape.points,
                              color: location.shape.color,
                              z: location.shape.z,
                          }
                        : null,
                    file,
                    hash: file ? await this.files.hashOf(file) : null,
                } satisfies TLocationSummary;
            })
        );
    }

    private async buildMaps(): Promise<TMapSummary[]> {
        const maps = story.maps ?? {};

        return await Promise.all(
            Object.entries(maps).map(async ([id, map]) => {
                const file = await this.findFile('data/maps', `${id}.map.ts`);
                return {
                    id,
                    title: map.title,
                    size: map.size,
                    background: map.background ?? null,
                    notes: map.notes ?? [],
                    strokes: map.strokes ?? [],
                    nestedMaps: map.maps ?? [],
                    // Filled in by `build()` once locations are known.
                    locationIds: [],
                    file,
                    hash: file ? await this.files.hashOf(file) : null,
                } satisfies TMapSummary;
            })
        );
    }

    private async buildCharacters(): Promise<TCharacterSummary[]> {
        const build = async (
            entries: [string, TCharacterEntry][],
            kind: 'character' | 'sideCharacter',
            directory: string
        ): Promise<TCharacterSummary[]> =>
            await Promise.all(
                entries.map(async ([id, entry]) => {
                    const file = await this.findFileByStem(directory, id);
                    return {
                        id,
                        name: entry.name ?? id,
                        kind,
                        startPassageId: entry.startPassageId ?? null,
                        file,
                        hash: file ? await this.files.hashOf(file) : null,
                    } satisfies TCharacterSummary;
                })
            );

        const [characters, sideCharacters] = await Promise.all([
            build(Object.entries(story.characters), 'character', 'data/characters'),
            build(Object.entries(story.sideCharacters), 'sideCharacter', 'data/sideCharacters'),
        ]);

        return [...characters, ...sideCharacters];
    }

    /**
     * Passages, by parsing every `.ts` under `data/chapters/`.
     *
     * The chapter folders are walked rather than `register.passages` being awaited, because the
     * register's entries are dynamic `import()`s that would *evaluate* the modules — and a
     * passage module's exports are functions, so evaluating it gains nothing and loses the
     * source positions `POST …/open` needs.
     */
    private async buildPassages(): Promise<TPassageSummary[]> {
        const files = await this.files.listFiles('data/chapters');
        const passageFiles = files.filter((file) => !file.endsWith('.chapter.ts'));

        const results = await Promise.all(
            passageFiles.map(async (file) => {
                const hash = await this.files.hashOf(file);
                try {
                    return this.passageIndexer.indexFile(this.files.resolvePath(file), file, hash);
                } catch {
                    // A file that does not parse is skipped rather than failing the whole index:
                    // the author is mid-edit and the other 40 passages are still readable.
                    return [];
                }
            })
        );

        return results.flat();
    }

    /** Where a named export lives, for `POST …/open`. */
    lineOfExport(repoRelativeFile: string, exportName: string): number {
        try {
            return this.passageIndexer.lineOfExport(this.files.resolvePath(repoRelativeFile), exportName);
        } catch {
            return 1;
        }
    }

    /** Exact path if it exists, else `null`. */
    private async findFile(directory: string, fileName: string): Promise<string> {
        const candidate = `${directory}/${fileName}`;
        return (await this.files.exists(candidate)) ? candidate : '';
    }

    /**
     * A file in `directory` whose stem matches `id` case-insensitively.
     *
     * Needed because the character files are `data/characters/thomas.ts` while the register
     * keys them `thomas`, and the side characters are `data/sideCharacters/Franta.ts` keyed
     * `franta` — the capitalisation does not match, and hard-coding either convention would
     * break the other.
     */
    private async findFileByStem(directory: string, id: string): Promise<string> {
        const files = await this.files.listFiles(directory);
        const wanted = id.toLowerCase();
        const match = files.find((file) => {
            const stem = file.split('/').pop()?.replace(/\.ts$/, '') ?? '';
            return stem.toLowerCase() === wanted;
        });
        return match ?? '';
    }
}

/**
 * Stable id for a trigger.
 *
 * Triggers are an inline array on the chapter with no id of their own, so one is synthesised
 * from the chapter plus the trigger's own name — falling back to the index only when there is
 * nothing else, since an index-based id changes meaning the moment a trigger is inserted above.
 */
const triggerId = (chapterId: string, trigger: unknown, index: number): string => {
    const raw = trigger as { id?: string; title?: string; name?: string };
    const local = raw.id ?? raw.title ?? raw.name ?? `${index}`;
    return `${chapterId}-${slug(local)}`;
};

const slug = (value: string): string =>
    value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
