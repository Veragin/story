import type { TVersioned, TVersionedBody } from './common';
import type { TApiErrorBody } from './errors';

/** Lengths are in UTF-16 code units; the server also checks branch names with `git check-ref-format --branch`. */
export const GIT_LIMITS = {
    messageMinLength: 1,
    messageMaxLength: 5000,
    remoteUrlMaxLength: 2048,
    tokenMaxLength: 1024,
    branchMaxLength: 255,
    authorNameMaxLength: 255,
    authorEmailMaxLength: 255,
} as const;

/** What the clients offer for a new connection. */
export const GIT_DEFAULT_BRANCH = 'master';

/** A client-side approximation of `git check-ref-format --branch`. */
export const GIT_BRANCH_PATTERN =
    /^(?![-/.])(?!.*(?:\.\.|@\{|\/\/|\/\.|\.lock(?:\/|$)))(?!@$)[^\s~^:?*[\\\p{Cc}]+(?<![/.])$/u;

export const isGitBranchName = (value: unknown): value is string =>
    typeof value === 'string' && value.length <= GIT_LIMITS.branchMaxLength && GIT_BRANCH_PATTERN.test(value);

/** Never carries the token. */
export type TGitConfigDto = TVersioned & {
    remoteUrl: string;
    branch: string;
    hasToken: boolean;
    authorName: string;
    authorEmail: string;
};

export const GIT_CHANGE_KINDS = ['added', 'modified', 'deleted', 'renamed'] as const;
export type TGitChangeKind = (typeof GIT_CHANGE_KINDS)[number];

export type TGitChangeDto = {
    /** Relative to the story folder, `/`-separated. */
    path: string;
    kind: TGitChangeKind;
};

export type TGitCommitDto = {
    hash: string;
    shortHash: string;
    subject: string;
    author: string;
    /** ISO date-time. */
    date: string;
};

/** `ahead` / `behind` and `remoteBranches` reflect the last `gitFetch`. */
export type TGitStatusDto = {
    /** The short commit hash when `detached`. */
    branch: string;
    detached: boolean;
    /** `null` before the first commit. */
    head: TGitCommitDto | null;
    ahead: number;
    behind: number;
    /** `origin/<branch>`, or `null` when the branch tracks nothing. */
    upstream: string | null;
    changes: TGitChangeDto[];
    localBranches: string[];
    /** Without the `origin/` prefix. */
    remoteBranches: string[];
    /** ISO date-time; `null` before the first fetch. */
    lastFetchedAt: string | null;
};

/** `config` and `status` are `null` while unavailable or not configured. */
export type TGitDto = {
    available: boolean;
    config: TGitConfigDto | null;
    status: TGitStatusDto | null;
};

/** `token`: absent or `''` keeps the current one, `null` clears it. */
export type TUpdateGitConfigBody = TVersionedBody &
    Partial<Omit<TGitConfigDto, 'hasToken' | 'version'>> & { token?: string | null };

/** `push`: the story becomes the repo's content. `pull`: the repo's content replaces the story. */
export const GIT_SETUP_MODES = ['push', 'pull'] as const;
export type TGitSetupMode = (typeof GIT_SETUP_MODES)[number];

/** `authorName` defaults to the story's author, `authorEmail` to the story's email, else `<storyId>@story.local`. */
export type TSetupGitBody = {
    remoteUrl: string;
    branch: string;
    token?: string;
    authorName?: string;
    authorEmail?: string;
    initial: TGitSetupMode;
};

/** `removeRepo` also deletes the story's `.git` folder. */
export type TDeleteGitConfigBody = TVersionedBody & { removeRepo: boolean };

export type TGitCommitBody = { message: string; push: boolean };

/** A failed push keeps the commit: `pushed: false` with the reason in `pushError`. */
export type TGitCommitResultDto = {
    commit: string;
    pushed: boolean;
    pushError?: TApiErrorBody;
    status: TGitStatusDto;
};

/** `from` / `to` are commit hashes; equal when nothing was `updated`. */
export type TGitPullResultDto = {
    updated: boolean;
    from: string;
    to: string;
    status: TGitStatusDto;
};

/**
 * `create`: a new branch from HEAD, the uncommitted changes come along;
 * else a local branch, or a remote one (a tracking branch is created).
 */
export type TGitCheckoutBody = { branch: string; create: boolean };

/** `local` / `remote`: where the branch exists; `commit` is the local tip, else the remote one. */
export type TGitBranchDto = {
    name: string;
    current: boolean;
    local: boolean;
    remote: boolean;
    commit: TGitCommitDto;
};

/** `remote` also deletes the branch on `origin`; the current branch cannot be deleted. */
export type TDeleteGitBranchBody = { branch: string; remote: boolean };
