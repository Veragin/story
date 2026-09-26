import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** The monorepo root, resolved from this file (`Visualizer/server/src/project/`). */
export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

/**
 * The story project the server reads and writes: a directory holding `data/` and `types/`.
 *
 * It is the repo root by default and `STORY_ROOT` when set, which is how tests run every write
 * against a temp copy (plan §5 rule 3). Everything that touches the disk resolves its paths here,
 * never with a hard-coded `../../data`.
 */
export class ProjectRoot {
    readonly root: string;
    readonly dataDir: string;
    readonly typesDir: string;

    constructor(root: string) {
        this.root = path.resolve(root);
        this.dataDir = path.join(this.root, 'data');
        this.typesDir = path.join(this.root, 'types');
    }

    /** `STORY_ROOT`, else the repo root. */
    static fromEnv(env: NodeJS.ProcessEnv = process.env): ProjectRoot {
        const configured = env.STORY_ROOT?.trim();
        return new ProjectRoot(configured ? configured : REPO_ROOT);
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
