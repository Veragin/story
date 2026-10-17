import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import type { TGitOptions } from '../../src/git/gitOptions';

const exec = promisify(execFile);

export const TEST_GIT_KEY = Buffer.alloc(32, 7);

export const TEST_GIT_OPTIONS: Partial<TGitOptions> = { tokenKey: TEST_GIT_KEY, allowFileRemotes: true };

const IDENTITY = ['-c', 'user.name=Remote', '-c', 'user.email=remote@test.local', '-c', 'protocol.file.allow=always'];

// a plain git, outside the server's runner: what another clone of the repo would do
export const git = async (cwd: string, ...args: string[]): Promise<string> =>
    (await exec('git', [...IDENTITY, ...args], { cwd })).stdout;

export type TBareRepo = { dir: string; url: string; scratch: string; cleanup: () => Promise<void> };

export const makeBareRepo = async (branch = 'main'): Promise<TBareRepo> => {
    const scratch = await mkdtemp(path.join(tmpdir(), 'story-git-'));
    const dir = path.join(scratch, 'remote.git');
    await exec('git', ['init', '-q', '--bare', '-b', branch, dir]);
    return {
        dir,
        url: pathToFileURL(dir).href,
        scratch,
        cleanup: () => rm(scratch, { recursive: true, force: true }),
    };
};

export const cloneRepo = async (repo: TBareRepo, name: string): Promise<string> => {
    const dest = path.join(repo.scratch, name);
    await git(repo.scratch, 'clone', '-q', repo.url, dest);
    return dest;
};

export const commitAndPush = async (clone: string, message: string, branch = 'main'): Promise<void> => {
    await git(clone, 'add', '-A');
    await git(clone, 'commit', '-q', '-m', message);
    await git(clone, 'push', '-q', 'origin', `HEAD:refs/heads/${branch}`);
};
