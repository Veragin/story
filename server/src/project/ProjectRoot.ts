import path from 'node:path';
import { REPO_ROOT } from '../config/env';

export const DEFAULT_STORIES_ROOT = path.join(REPO_ROOT, 'stories');

export const EXAMPLE_STORY_ROOT = path.join(DEFAULT_STORIES_ROOT, 'example');

const ENGINE_PACKAGE_ENTRIES: Readonly<Record<string, string>> = {
    '@story/core': 'clients/shared/core/src/index.ts',
    '@story/shared': 'clients/shared/utils/src/index.ts',
    '@story/ui': 'clients/shared/ui/src/index.ts',
};

export const enginePaths = (fromRepo: (repoRelative: string) => string): Record<string, string[]> =>
    Object.fromEntries(Object.entries(ENGINE_PACKAGE_ENTRIES).map(([name, entry]) => [name, [fromRepo(entry)]]));

export class ProjectRoot {
    readonly root: string;
    readonly dataDir: string;
    readonly typesDir: string;
    readonly storyId: string;

    constructor(root: string, storyId?: string) {
        this.root = path.resolve(root);
        this.dataDir = path.join(this.root, 'data');
        this.typesDir = path.join(this.root, 'types');
        this.storyId = storyId ?? path.basename(this.root);
    }

    abs(...relative: string[]): string {
        const resolved = path.resolve(this.root, ...relative);
        if (resolved !== this.root && !resolved.startsWith(this.root + path.sep)) {
            throw new Error(`Path escapes the project root: ${relative.join('/')}`);
        }
        return resolved;
    }

    rel(absolute: string): string {
        return path.relative(this.root, absolute).split(path.sep).join('/');
    }

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
