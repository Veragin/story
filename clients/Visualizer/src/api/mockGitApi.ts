import {
    GIT_LIMITS,
    isGitBranchName,
    type TApiErrorBody,
    type TChangeEvent,
    type TGitBranchDto,
    type TGitChangeKind,
    type TGitConfigDto,
    type TGitDto,
    type TGitLogEntryDto,
    type TGitStatusDto,
    type TVersion,
} from '@story/protocol';
import { ApiError } from './ApiError';
import { fail, notFound } from './mockHelpers';
import type { TVisualizerApi } from './types';

type TMockGitContext = {
    storyId: string;
    storyAuthor: string;
    available: boolean;
    nextVersion: () => TVersion;
    reply: <T>(fn: () => T) => Promise<T>;
    checkVersion: (current: { version: TVersion } | undefined, version: TVersion) => void;
    emitStory: () => void;
};

type TGitRoutes =
    | 'getGit'
    | 'updateGitConfig'
    | 'setupGit'
    | 'deleteGitConfig'
    | 'gitFetch'
    | 'gitCommit'
    | 'gitPush'
    | 'gitForcePush'
    | 'gitPull'
    | 'gitCheckout'
    | 'gitDiscard'
    | 'getGitBranches'
    | 'deleteGitBranch'
    | 'getGitLog';

type TBranches = Map<string, TGitLogEntryDto[]>;

type TRepo = {
    branch: string;
    local: TBranches;
    // the remote as of the last fetch
    known: TBranches;
    changes: Map<string, TGitChangeKind>;
    lastFetchedAt: string | null;
};

export type TMockRemoteCommit = { branch?: string; subject?: string; conflict?: string[] };

const copyBranches = (branches: TBranches): TBranches => new Map([...branches].map(([b, list]) => [b, [...list]]));

const tipOf = (list: TGitLogEntryDto[] | undefined) => {
    const tip = list?.[0];
    if (!tip) return null;
    const { hash, shortHash, subject, author, date } = tip;
    return { hash, shortHash, subject, author, date };
};

const changePath = (event: TChangeEvent) =>
    event.kind === 'map' ? `data/locations/${event.id}.json` : `data/${event.kind}/${event.id}.ts`;

const changeKind = (op: TChangeEvent['op'], previous: TGitChangeKind | undefined): TGitChangeKind | null => {
    if (op === 'deleted') return previous === 'added' ? null : 'deleted';
    if (op === 'created' || previous === 'added') return 'added';
    return 'modified';
};

const remoteUrlError = (value: string): string | null => {
    if (value.length > GIT_LIMITS.remoteUrlMaxLength) return 'The remote URL is too long';
    try {
        const url = new URL(value);
        if (url.protocol !== 'https:') return 'The remote URL must use https';
        if (url.username || url.password) return 'The remote URL must not contain credentials';
        return null;
    } catch {
        return 'Not a URL';
    }
};

const badRequest = (message: string) => fail(400, { error: 'bad_request', message });

export const createMockGitApi = (ctx: TMockGitContext) => {
    let config: TGitConfigDto | null = null;
    let repo: TRepo | null = null;
    let origin: TBranches = new Map();
    let conflicts = new Map<string, string[]>();
    let hashCounter = 0;

    const commitOf = (subject: string, author: string, files?: string[]): TGitLogEntryDto => {
        const hash = (++hashCounter).toString(16).padStart(8, '0').repeat(5);
        return { hash, shortHash: hash.slice(0, 7), subject, author, date: new Date().toISOString(), files };
    };

    const requireRepo = (): { config: TGitConfigDto; repo: TRepo } => {
        if (!ctx.available) return fail(503, { error: 'git_unavailable', message: 'mock: git is off' });
        if (!config || !repo) return fail(409, { error: 'git_not_configured', message: 'No git config' });
        return { config, repo };
    };

    const requireClean = (r: TRepo) => {
        if (r.changes.size > 0) fail(409, { error: 'git_dirty', message: `${r.changes.size} uncommitted changes` });
    };

    const missingFrom = (list: TGitLogEntryDto[], other: TGitLogEntryDto[]) => {
        const hashes = new Set(other.map((c) => c.hash));
        return list.filter((c) => !hashes.has(c.hash));
    };

    const statusOf = (r: TRepo): TGitStatusDto => {
        const local = r.local.get(r.branch) ?? [];
        const remote = r.known.get(r.branch);
        return {
            branch: r.branch,
            detached: false,
            head: tipOf(local),
            ahead: missingFrom(local, remote ?? []).length,
            behind: missingFrom(remote ?? [], local).length,
            upstream: remote ? `origin/${r.branch}` : null,
            changes: [...r.changes].map(([path, kind]) => ({ path, kind })),
            localBranches: [...r.local.keys()].sort(),
            remoteBranches: [...r.known.keys()].sort(),
            lastFetchedAt: r.lastFetchedAt,
        };
    };

    const dto = (): TGitDto => ({
        available: ctx.available,
        config: ctx.available ? config : null,
        status: ctx.available && config && repo ? statusOf(repo) : null,
    });

    const fetchOrigin = (r: TRepo) => {
        r.known = copyBranches(origin);
        r.lastFetchedAt = new Date().toISOString();
    };

    const pushNow = (r: TRepo, force = false) => {
        const local = r.local.get(r.branch) ?? [];
        if (!force && missingFrom(origin.get(r.branch) ?? [], local).length > 0) {
            fail(409, { error: 'git_rejected', message: 'Updates were rejected: the remote contains newer work' });
        }
        origin.set(r.branch, [...local]);
        r.known.set(r.branch, [...local]);
    };

    const validateBranch = (branch: string) => {
        if (!isGitBranchName(branch)) badRequest(`"${branch}" is not a valid branch name`);
    };

    const touch = (event: TChangeEvent) => {
        if (!repo) return;
        const path = changePath(event);
        const kind = changeKind(event.op, repo.changes.get(path));
        if (kind) repo.changes.set(path, kind);
        else repo.changes.delete(path);
    };

    const reset = () => {
        config = null;
        repo = null;
        origin = new Map();
        conflicts = new Map();
    };

    const setAuthorEmail = (email: string) => {
        if (config) config = { ...config, authorEmail: email, version: ctx.nextVersion() };
    };

    const simulateRemoteCommit = ({ branch, subject = 'Remote change', conflict }: TMockRemoteCommit = {}) => {
        const target = branch ?? config?.branch ?? 'main';
        const commit = commitOf(subject, 'Someone else', conflict);
        origin.set(target, [commit, ...(origin.get(target) ?? [])]);
        if (conflict) conflicts.set(commit.hash, conflict);
    };

    const routes: Pick<TVisualizerApi, TGitRoutes> = {
        getGit: () => ctx.reply(dto),

        setupGit: ({ remoteUrl, branch, token, authorName, authorEmail, initial }) =>
            ctx.reply(() => {
                if (!ctx.available) return fail(503, { error: 'git_unavailable', message: 'mock: git is off' });
                if (config) return fail(409, { error: 'exists', message: 'Git is already set up' });
                const urlError = remoteUrlError(remoteUrl);
                if (urlError) badRequest(urlError);
                validateBranch(branch);
                const name = authorName || ctx.storyAuthor || ctx.storyId;
                const next: TRepo = {
                    branch,
                    local: new Map(),
                    known: copyBranches(origin),
                    changes: new Map(),
                    lastFetchedAt: new Date().toISOString(),
                };
                const remote = origin.get(branch);
                if (initial === 'push') {
                    if (remote && remote.length > 0) {
                        fail(409, { error: 'git_rejected', message: 'The remote branch has commits: use pull' });
                    }
                    next.local.set(branch, [commitOf('Initial story', name)]);
                    pushNow(next);
                } else {
                    if (!remote)
                        return fail(502, { error: 'git_remote', message: `No branch "${branch}" on the remote` });
                    next.local.set(branch, [...remote]);
                    ctx.emitStory();
                }
                repo = next;
                config = {
                    remoteUrl,
                    branch,
                    hasToken: Boolean(token),
                    authorName: name,
                    authorEmail: authorEmail || `${ctx.storyId}@story.local`,
                    version: ctx.nextVersion(),
                };
                return dto();
            }),

        updateGitConfig: ({ version, token, remoteUrl, branch, authorName, authorEmail }) =>
            ctx.reply(() => {
                const current = requireRepo().config;
                ctx.checkVersion(current, version);
                const urlError = remoteUrl === undefined ? null : remoteUrlError(remoteUrl);
                if (urlError) badRequest(urlError);
                if (branch !== undefined) validateBranch(branch);
                config = {
                    remoteUrl: remoteUrl ?? current.remoteUrl,
                    branch: branch ?? current.branch,
                    authorName: authorName ?? current.authorName,
                    authorEmail: authorEmail ?? current.authorEmail,
                    hasToken: token === null ? false : token ? true : current.hasToken,
                    version: ctx.nextVersion(),
                };
                return dto();
            }),

        deleteGitConfig: ({ version, removeRepo }) =>
            ctx.reply(() => {
                ctx.checkVersion(requireRepo().config, version);
                config = null;
                if (removeRepo) repo = null;
                return undefined;
            }),

        gitFetch: () =>
            ctx.reply(() => {
                const r = requireRepo().repo;
                fetchOrigin(r);
                return statusOf(r);
            }),

        gitCommit: ({ message, push }) =>
            ctx.reply(() => {
                const { config: c, repo: r } = requireRepo();
                const text = message.trim();
                if (text.length < GIT_LIMITS.messageMinLength || text.length > GIT_LIMITS.messageMaxLength) {
                    badRequest('The commit message is empty or too long');
                }
                if (r.changes.size === 0) fail(409, { error: 'git_nothing_to_commit', message: 'Nothing to commit' });
                const commit = commitOf(text.split('\n')[0], c.authorName, [...r.changes.keys()]);
                r.local.set(r.branch, [commit, ...(r.local.get(r.branch) ?? [])]);
                r.changes.clear();
                let pushError: TApiErrorBody | undefined;
                if (push) {
                    try {
                        pushNow(r);
                    } catch (e) {
                        if (!(e instanceof ApiError)) throw e;
                        pushError = e.body;
                    }
                }
                return {
                    commit: commit.hash,
                    pushed: push && !pushError,
                    ...(pushError ? { pushError } : {}),
                    status: statusOf(r),
                };
            }),

        gitPush: () =>
            ctx.reply(() => {
                const r = requireRepo().repo;
                pushNow(r);
                return statusOf(r);
            }),

        gitForcePush: () =>
            ctx.reply(() => {
                const r = requireRepo().repo;
                pushNow(r, true);
                return statusOf(r);
            }),

        gitPull: () =>
            ctx.reply(() => {
                const { config: c, repo: r } = requireRepo();
                requireClean(r);
                fetchOrigin(r);
                const local = r.local.get(r.branch) ?? [];
                const incoming = missingFrom(r.known.get(r.branch) ?? [], local);
                const from = local[0]?.hash ?? '';
                if (incoming.length === 0) return { updated: false, from, to: from, status: statusOf(r) };
                const ahead = missingFrom(local, r.known.get(r.branch) ?? []).length > 0;
                const files = incoming.flatMap((commit) => conflicts.get(commit.hash) ?? []);
                if (ahead && files.length > 0) fail(409, { error: 'git_conflict', files });
                const merged = ahead
                    ? [commitOf(`Merge origin/${r.branch}`, c.authorName), ...incoming, ...local]
                    : [...incoming, ...local];
                r.local.set(r.branch, merged);
                ctx.emitStory();
                return { updated: true, from, to: merged[0].hash, status: statusOf(r) };
            }),

        gitCheckout: ({ branch, create }) =>
            ctx.reply(() => {
                const r = requireRepo().repo;
                validateBranch(branch);
                if (!create) requireClean(r);
                if (create) {
                    if (r.local.has(branch)) fail(409, { error: 'exists', message: `Branch "${branch}" exists` });
                    r.local.set(branch, [...(r.local.get(r.branch) ?? [])]);
                } else if (!r.local.has(branch)) {
                    const remote = r.known.get(branch) ?? notFound(`branch "${branch}"`);
                    r.local.set(branch, [...remote]);
                }
                const changed = r.branch !== branch;
                r.branch = branch;
                if (changed && !create) ctx.emitStory();
                return statusOf(r);
            }),

        gitDiscard: () =>
            ctx.reply(() => {
                const r = requireRepo().repo;
                if (r.changes.size === 0) return statusOf(r);
                r.changes.clear();
                ctx.emitStory();
                return statusOf(r);
            }),

        getGitBranches: () =>
            ctx.reply(() => {
                const r = requireRepo().repo;
                const names = new Set([...r.local.keys(), ...r.known.keys()]);
                return [...names]
                    .flatMap((name): TGitBranchDto[] => {
                        const commit = tipOf(r.local.get(name)) ?? tipOf(r.known.get(name));
                        if (!commit) return [];
                        const current = name === r.branch;
                        return [{ name, current, local: r.local.has(name), remote: r.known.has(name), commit }];
                    })
                    .sort((a, b) => b.commit.date.localeCompare(a.commit.date) || a.name.localeCompare(b.name));
            }),

        deleteGitBranch: ({ branch, remote }) =>
            ctx.reply(() => {
                const r = requireRepo().repo;
                validateBranch(branch);
                if (branch === r.branch) badRequest('Switch to another branch before you delete this one');
                const onRemote = remote && r.known.has(branch);
                if (!r.local.has(branch) && !onRemote) notFound(`branch "${branch}"`);
                if (onRemote) {
                    origin.delete(branch);
                    r.known.delete(branch);
                }
                r.local.delete(branch);
                return statusOf(r);
            }),

        getGitLog: (query = {}) =>
            ctx.reply(() => {
                const r = requireRepo().repo;
                const limit = Math.min(Math.max(query.limit ?? GIT_LIMITS.logLimitDefault, 1), GIT_LIMITS.logLimitMax);
                const list = r.local.get(r.branch) ?? [];
                const index = query.before ? list.findIndex((c) => c.hash === query.before) : -1;
                if (query.before && index === -1) return [];
                return list.slice(index + 1, index + 1 + limit);
            }),
    };

    return { routes, touch, reset, setAuthorEmail, simulateRemoteCommit };
};
