import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { EXAMPLE_STORY_ROOT, ProjectRoot } from '../src/project/ProjectRoot';
import { STORY_FILE } from '../src/stories/StoryStore';

/** Copy the example story (`data/`, `types/`, `story.json`, `tsconfig.json`) to `<storiesRoot>/<id>/`. */
export const copyExampleStory = async (storiesRoot: string, id: string): Promise<ProjectRoot> => {
    const dir = path.join(storiesRoot, id);
    const skip = (src: string) => !src.includes(`${path.sep}node_modules`);
    for (const entry of ['data', 'types', STORY_FILE, 'tsconfig.json']) {
        await cp(path.join(EXAMPLE_STORY_ROOT, entry), path.join(dir, entry), { recursive: true, filter: skip });
    }
    return new ProjectRoot(dir, id);
};

/**
 * A throw-away `STORIES_ROOT` in the OS temp dir holding a copy of the example story under each
 * of `ids` — the only thing server tests may write to (plan §5 rule 3). Equivalent to running the
 * server with `STORIES_ROOT=<storiesRoot>`.
 */
export const makeTempStories = async (
    ids: string[] = ['example']
): Promise<{ storiesRoot: string; projects: ProjectRoot[]; cleanup: () => Promise<void> }> => {
    const storiesRoot = await mkdtemp(path.join(tmpdir(), 'visualizer-server-'));
    const projects: ProjectRoot[] = [];
    for (const id of ids) projects.push(await copyExampleStory(storiesRoot, id));
    return { storiesRoot, projects, cleanup: () => rm(storiesRoot, { recursive: true, force: true }) };
};

/** `makeTempStories()` with just the `example` story, and its `ProjectRoot`. */
export const makeTempProject = async (): Promise<{
    storiesRoot: string;
    project: ProjectRoot;
    cleanup: () => Promise<void>;
}> => {
    const { storiesRoot, projects, cleanup } = await makeTempStories();
    return { storiesRoot, project: projects[0], cleanup };
};

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The example story's password (`stories/example/story.json` holds its scrypt hash). */
export const EXAMPLE_PASSWORD = 'example';

/**
 * Log in to a story of the server at `base` (every copy of the example story has its password)
 * and return the `cookie` header value that carries the grant: `story_session=<token>`.
 * Pass the previous value as `cookie` to add a grant to the same session.
 */
export const login = async (
    base: string,
    storyId = 'example',
    { password = EXAMPLE_PASSWORD, cookie }: { password?: string; cookie?: string } = {}
): Promise<string> => {
    const res = await fetch(`${base}/api/stories/${storyId}/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
        body: JSON.stringify({ password }),
    });
    if (res.status !== 204) throw new Error(`login to ${storyId} answered ${res.status}`);
    const setCookie = res.headers.get('set-cookie') ?? '';
    return setCookie.split(';')[0];
};
