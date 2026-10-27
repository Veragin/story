import path from 'node:path';
import type { TGitBranchDto, TGitCommitDto, TGitStatusDto } from '@story/protocol';
import { lstatOrNull } from '../common/fileStat';
import { HttpError } from '../common/HttpError';
import { asRemote } from './gitErrors';
import type { GitRunner } from './GitRunner';
import {
    BRANCH_FORMAT,
    LOG_FORMAT,
    parseBranches,
    parseLog,
    parsePathList,
    parsePorcelainStatus,
    parseRefs,
    type TRefs,
} from './gitStatus';

export type TAuthor = { authorName: string; authorEmail: string };

const SHORT_HASH_LENGTH = 7;

const identity = ({ authorName, authorEmail }: TAuthor) => ({ 'user.name': authorName, 'user.email': authorEmail });

export const gitDir = (git: GitRunner) => path.join(git.cwd, '.git');

const lastFetchedAt = async (git: GitRunner): Promise<string | null> => {
    const fetched = await lstatOrNull(path.join(gitDir(git), 'FETCH_HEAD'));
    return fetched ? fetched.mtime.toISOString() : null;
};

export const readRefs = async (git: GitRunner): Promise<TRefs> =>
    parseRefs(await git.text(['for-each-ref', '--format=%(refname)', 'refs/heads', 'refs/remotes/origin']));

// null: no commits yet
const readHead = async (git: GitRunner): Promise<TGitCommitDto | null> => {
    const { stdout, code } = await git.run(['log', '-1', LOG_FORMAT, 'HEAD', '--'], { okCodes: [128] });
    if (code !== 0) return null;
    const [head] = parseLog(stdout);
    return head ?? null;
};

export const readStatus = async (git: GitRunner): Promise<TGitStatusDto> => {
    const [porcelain, refs, fetchedAt, head] = await Promise.all([
        git.text(['--no-optional-locks', 'status', '--porcelain=v2', '--branch', '-z', '--untracked-files=all']),
        readRefs(git),
        lastFetchedAt(git),
        readHead(git),
    ]);
    const status = parsePorcelainStatus(porcelain);
    return {
        branch: status.head ?? status.oid?.slice(0, SHORT_HASH_LENGTH) ?? '',
        detached: status.head === null,
        head,
        ahead: status.ahead,
        behind: status.behind,
        upstream: status.upstream,
        changes: status.changes,
        ...refs,
        lastFetchedAt: fetchedAt,
    };
};

export const readBranches = async (git: GitRunner, current: string | null): Promise<TGitBranchDto[]> =>
    parseBranches(await git.text(['for-each-ref', BRANCH_FORMAT, 'refs/heads', 'refs/remotes/origin']), current);

export const requireClean = (status: TGitStatusDto, action: string) => {
    if (status.changes.length > 0) {
        throw HttpError.of(
            'git_dirty',
            `Commit or discard the ${status.changes.length} change(s) before you ${action}`
        );
    }
};

export const checkBranchName = async (git: GitRunner, branch: string): Promise<void> => {
    const { code } = await git.run(['check-ref-format', '--branch', branch], { okCodes: [1, 128] });
    if (code !== 0) throw HttpError.badRequest(`"${branch}" is not a valid branch name`);
};

export const resolveCommit = async (git: GitRunner, rev: string): Promise<string | null> => {
    const { stdout, code } = await git.run(['rev-parse', '--verify', '-q', `${rev}^{commit}`], { okCodes: [1] });
    return code === 0 ? stdout.trim() : null;
};

// null: nothing was staged
export const commitAll = async (git: GitRunner, message: string, author: TAuthor): Promise<string | null> => {
    await git.run(['add', '-A']);
    const { code } = await git.run(['diff', '--cached', '--quiet'], { okCodes: [1] });
    if (code === 0) return null;
    await git.run(['commit', '-q', '-F', '-'], { input: message, config: identity(author) });
    return resolveCommit(git, 'HEAD');
};

type TPushOptions = { branch?: string; force?: boolean };

export const pushHead = async (git: GitRunner, { branch, force = false }: TPushOptions = {}): Promise<void> => {
    const target = branch ? `HEAD:refs/heads/${branch}` : 'HEAD';
    await asRemote(git.run(['push', '-u', ...(force ? ['--force'] : []), 'origin', target], { network: true }));
};

export const deleteRemoteBranch = async (git: GitRunner, branch: string): Promise<void> => {
    await asRemote(git.run(['push', 'origin', '--delete', branch], { network: true }));
};

export const fetchOrigin = async (git: GitRunner): Promise<void> => {
    await asRemote(git.run(['fetch', '--prune', 'origin'], { network: true }));
};

export const setOrigin = async (git: GitRunner, remoteUrl: string): Promise<void> => {
    await git.run(['remote', 'remove', 'origin'], { okCodes: [2] });
    await git.run(['remote', 'add', 'origin', remoteUrl]);
};

// a conflict leaves the tree as it was: the merge is aborted before the error goes out
export const mergeNoEdit = async (git: GitRunner, upstream: string, author: TAuthor): Promise<void> => {
    const { code } = await git.run(['merge', '--no-edit', '-q', upstream], { config: identity(author), okCodes: [1] });
    if (code === 0) return;
    const files = parsePathList(await git.text(['diff', '--name-only', '--diff-filter=U', '-z']));
    await git.run(['merge', '--abort'], { okCodes: [128] });
    if (files.length === 0) throw new Error(`git merge ${upstream} failed without a conflict`);
    throw new HttpError({ error: 'git_conflict', message: `The merge of ${upstream} conflicts`, files });
};
