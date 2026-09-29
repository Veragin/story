import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** The monorepo root, resolved from this file (`Visualizer/server/src/project/`). */
export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

/** Where the stories live by default, one folder per story (`STORIES_ROOT` overrides it). */
export const DEFAULT_STORIES_ROOT = path.join(REPO_ROOT, 'stories');

/**
 * The reference story, `stories/example/` (multiple stories, phase 2 moved it there from the repo
 * root). It is what the tests copy, and whose path the prettier config is resolved for.
 */
export const EXAMPLE_STORY_ROOT = path.join(DEFAULT_STORIES_ROOT, 'example');

/**
 * One story project the server reads and writes: a directory `<STORIES_ROOT>/<storyId>/` holding
 * `data/` and `types/` (and `story.json`, which is `StoryStore`'s, not this class's).
 *
 * `StoryContexts` makes one per loaded story; tests point `STORIES_ROOT` at a temp copy so every
 * write lands there (plan §5 rule 3). Everything that touches the disk resolves its paths here,
 * never with a hard-coded `../../data`.
 */
export class ProjectRoot {
    readonly root: string;
    readonly dataDir: string;
    readonly typesDir: string;
    /** The story's id, which is its folder name unless given; it goes into URLs (`TImageDto.url`). */
    readonly storyId: string;

    constructor(root: string, storyId?: string) {
        this.root = path.resolve(root);
        this.dataDir = path.join(this.root, 'data');
        this.typesDir = path.join(this.root, 'types');
        this.storyId = storyId ?? path.basename(this.root);
    }

    /**
     * Absolute path of a project-relative path (`data/locations/map.json`). Throws when the result
     * would escape the root, so an id from a URL can never address a file outside the project.
     */
    abs(...relative: string[]): string {
        const resolved = path.resolve(this.root, ...relative);
        if (resolved !== this.root && !resolved.startsWith(this.root + path.sep)) {
            throw new Error(`Path escapes the project root: ${relative.join('/')}`);
        }
        return resolved;
    }

    /** Project-relative path with `/` separators — the form DTOs carry (`TSourceRef.file`). */
    rel(absolute: string): string {
        return path.relative(this.root, absolute).split(path.sep).join('/');
    }

    /** Well-known files. */
    get paths() {
        return {
            register: this.abs('data/register.ts'),
            worldState: this.abs('data/TWorldState.ts'),
            chaptersDir: this.abs('data/chapters'),
            timelineLayout: this.abs('data/chapters/timeline.layout.json'),
            map: this.abs('data/locations/map.json'),
            chapterDir: (chapterId: string) => this.abs('data/chapters', chapterId),
            chapterFile: (chapterId: string) => this.abs('data/chapters', chapterId, `${chapterId}.chapter.ts`),
            chapterPassagesFile: (chapterId: string) =>
                this.abs('data/chapters', chapterId, `${chapterId}.passages.ts`),
            chapterLayout: (chapterId: string) => this.abs('data/chapters', chapterId, `${chapterId}.layout.json`),
            triggersFile: (chapterId: string) => this.abs('data/chapters', chapterId, 'triggers.ts'),
            characterPassagesDir: (chapterId: string, characterId: string) =>
                this.abs('data/chapters', chapterId, `${characterId}.passages`),
        };
    }
}
