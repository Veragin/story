import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { EXAMPLE_STORY_ROOT, ProjectRoot } from '../../src/project/ProjectRoot';
import { STORY_FILE, type TStoryFile } from '../../src/stories/storyFile';

export type TTempStoriesRoot = { root: string; cleanup: () => Promise<void> };

export const makeTempStoriesRoot = async (): Promise<TTempStoriesRoot> => {
    const root = await mkdtemp(path.join(tmpdir(), 'story-server-'));
    return { root, cleanup: () => rm(root, { recursive: true, force: true }) };
};

export const copyExampleStory = async (root: string, id: string): Promise<string> => {
    const dir = path.join(root, id);
    const skip = (src: string) => !src.includes(`${path.sep}node_modules`);
    await cp(EXAMPLE_STORY_ROOT, dir, { recursive: true, filter: skip });
    return dir;
};

export const STORY_FIXTURE: TStoryFile = {
    name: 'Alpha',
    author: 'Tester',
    password: 'scrypt$16384$8$1$salt$hash',
    mapSize: { width: 40, height: 30 },
    description: 'A test story',
    public: false,
};

export const storyFixture = (overrides: Partial<TStoryFile> = {}): TStoryFile => ({ ...STORY_FIXTURE, ...overrides });

export const writeStoryFolder = async (
    root: string,
    id: string,
    files: { storyJson?: string; tsconfig?: string } = {}
): Promise<string> => {
    const dir = path.join(root, id);
    await mkdir(path.join(dir, 'data'), { recursive: true });
    if (files.storyJson !== undefined) await writeFile(path.join(dir, STORY_FILE), files.storyJson);
    if (files.tsconfig !== undefined) await writeFile(path.join(dir, 'tsconfig.json'), files.tsconfig);
    return dir;
};

// the old suites' temp roots: copies of the example without DB rows; seed them with createTestApp({ stories })
export const makeTempStories = async (
    ids: readonly string[] = ['example']
): Promise<{ storiesRoot: string; projects: ProjectRoot[]; cleanup: () => Promise<void> }> => {
    const { root, cleanup } = await makeTempStoriesRoot();
    const projects: ProjectRoot[] = [];
    for (const id of ids) projects.push(new ProjectRoot(await copyExampleStory(root, id), id));
    return { storiesRoot: root, projects, cleanup };
};

export const makeTempProject = async (): Promise<{
    storiesRoot: string;
    project: ProjectRoot;
    cleanup: () => Promise<void>;
}> => {
    const { storiesRoot, projects, cleanup } = await makeTempStories();
    return { storiesRoot, project: projects[0], cleanup };
};
