import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ProjectRoot, REPO_ROOT } from '../src/project/ProjectRoot';

/**
 * A throw-away copy of the story (`data/` + `types/`) in the OS temp dir — the only thing server
 * tests may write to (plan §5 rule 3). Equivalent to running the server with `STORY_ROOT=<dir>`.
 */
export const makeTempProject = async (): Promise<{ project: ProjectRoot; cleanup: () => Promise<void> }> => {
    const dir = await mkdtemp(path.join(tmpdir(), 'visualizer-server-'));
    const skip = (src: string) => !src.includes(`${path.sep}node_modules`);
    await cp(path.join(REPO_ROOT, 'data'), path.join(dir, 'data'), { recursive: true, filter: skip });
    await cp(path.join(REPO_ROOT, 'types'), path.join(dir, 'types'), { recursive: true, filter: skip });
    return {
        project: new ProjectRoot(dir),
        cleanup: () => rm(dir, { recursive: true, force: true }),
    };
};

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
