import { readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Inject, Injectable } from '@nestjs/common';
import type {
    TGitCommitResultDto,
    TGitConfigDto,
    TGitDto,
    TGitLogEntryDto,
    TGitPullResultDto,
    TGitStatusDto,
} from '@story/protocol';
import { jsonObjectBody } from '../common/body';
import { exists } from '../common/fileStat';
import { HttpError, isHttpError } from '../common/HttpError';
import {
    StoryGitRepository,
    type TStoryGitRecord,
    type TVersionedStoryGit,
} from '../database/repositories/StoryGitRepository';
import { StoryRepository } from '../database/repositories/StoryRepository';
import { rewriteInBulk } from '../events/rewriteInBulk';
import { isMissingFileError } from '../json/atomicWrite';
import { StoryFolders } from '../stories/StoryFolders';
import { storyMapSize } from '../stories/storyInput';
import { checkStoryTree } from '../stories/storyTree';
import type { TServerContext } from '../storyContext/serverContext';
import { StoryContexts } from '../storyContext/StoryContexts';
import { GitAvailability } from './GitAvailability';
import {
    checkBranchName,
    commitAll,
    fetchOrigin,
    gitDir,
    mergeNoEdit,
    pushHead,
    readRefs,
    readStatus,
    requireClean,
    resolveCommit,
    setOrigin,
} from './gitCommands';
import {
    parseCheckoutBody,
    parseCommitBody,
    parseConfigChange,
    parseDeleteBody,
    parseLogQuery,
    parseSetupBody,
    type TSetupInput,
} from './gitInput';
import { GitLocks } from './GitLocks';
import { GIT_OPTIONS, type TGitOptions } from './gitOptions';
import { GitRunner } from './GitRunner';
import { LOG_FORMAT, parseLog, type TRefs } from './gitStatus';
import { GITIGNORE_FILE, STORY_GITIGNORE } from './storyGitignore';
import { decryptToken, encryptToken, TokenCipherError } from './tokenCipher';

const INITIAL_COMMIT_MESSAGE = 'Initial story';

const SETUP_ROOT_EXTRAS = ['.git', GITIGNORE_FILE];

const UNAVAILABLE: TGitDto = { available: false, config: null, status: null };

type TRepo = { git: GitRunner; current: TVersionedStoryGit };

const configDto = ({ record, version }: TVersionedStoryGit): TGitConfigDto => ({
    remoteUrl: record.remoteUrl,
    branch: record.branch,
    hasToken: record.tokenEncrypted !== null,
    authorName: record.authorName,
    authorEmail: record.authorEmail,
    version,
});

// a remote branch gets a local tracking branch
const switchArgs = (branch: string, { localBranches, remoteBranches }: TRefs): string[] => {
    if (localBranches.includes(branch)) return [branch];
    if (remoteBranches.includes(branch)) return ['-c', branch, '--track', `origin/${branch}`];
    throw HttpError.notFound(`No branch "${branch}"`);
};

const notConfigured = (storyId: string) =>
    HttpError.of('git_not_configured', `Story "${storyId}" is not connected to a git repository`);

@Injectable()
export class GitService {
    constructor(
        private readonly availability: GitAvailability,
        @Inject(GIT_OPTIONS) private readonly options: TGitOptions,
        private readonly rows: StoryGitRepository,
        private readonly stories: StoryRepository,
        private readonly folders: StoryFolders,
        private readonly locks: GitLocks,
        private readonly contexts: StoryContexts
    ) {}

    getGit(ctx: TServerContext): Promise<TGitDto> {
        if (!this.enabledFor(ctx.storyId)) return Promise.resolve(UNAVAILABLE);
        return this.locks.run(ctx.storyId, () => this.gitDto(ctx));
    }

    updateConfig(ctx: TServerContext, body: unknown): Promise<TGitDto> {
        const fields = jsonObjectBody(body);
        const key = this.key(ctx.storyId);
        return this.locks.run(ctx.storyId, async () => {
            const current = await this.versioned(ctx, fields.version);
            const change = parseConfigChange(fields, this.options, current.record);
            const next: TStoryGitRecord = {
                remoteUrl: change.remoteUrl ?? current.record.remoteUrl,
                branch: change.branch ?? current.record.branch,
                authorName: change.authorName ?? current.record.authorName,
                authorEmail: change.authorEmail ?? current.record.authorEmail,
                tokenEncrypted:
                    change.token === undefined
                        ? current.record.tokenEncrypted
                        : change.token && encryptToken(key, change.token),
            };
            const git = this.runner(ctx.project.root, null);
            if (change.branch !== undefined) await checkBranchName(git, change.branch);
            if (next.remoteUrl !== current.record.remoteUrl && (await exists(gitDir(git)))) {
                await setOrigin(git, next.remoteUrl);
            }
            const version = await this.rows.write(ctx.storyId, next, current.version);
            if (version === null) throw await this.stale(ctx);
            return this.gitDto(ctx);
        });
    }

    setup(ctx: TServerContext, body: unknown): Promise<TGitDto> {
        const fields = jsonObjectBody(body);
        const { storyId } = ctx;
        const key = this.key(storyId);
        return this.locks.run(storyId, async () => {
            if (await this.rows.read(storyId)) throw HttpError.exists(`Story "${storyId}" is already connected to git`);
            const story = await this.stories.read(storyId);
            if (!story) throw HttpError.noStory(storyId);
            const input = parseSetupBody(fields, this.options, {
                authorName: story.author || storyId,
                authorEmail: `${storyId}@story.local`,
            });
            await checkBranchName(this.runner(ctx.project.root, null), input.branch);
            const record: TStoryGitRecord = {
                remoteUrl: input.remoteUrl,
                branch: input.branch,
                tokenEncrypted: input.token && encryptToken(key, input.token),
                authorName: input.authorName,
                authorEmail: input.authorEmail,
            };
            if (input.initial === 'push') await this.setupPush(ctx, input, record);
            else await this.setupPull(ctx, input, record);
            return this.gitDto(ctx);
        });
    }

    deleteConfig(ctx: TServerContext, body: unknown): Promise<void> {
        const fields = jsonObjectBody(body);
        this.key(ctx.storyId);
        return this.locks.run(ctx.storyId, async () => {
            const current = await this.versioned(ctx, fields.version);
            const { removeRepo } = parseDeleteBody(fields);
            if (!(await this.rows.delete(ctx.storyId, current.version))) throw await this.stale(ctx);
            if (removeRepo) await rm(path.join(ctx.project.root, '.git'), { recursive: true, force: true });
        });
    }

    fetch(ctx: TServerContext): Promise<TGitStatusDto> {
        return this.withRepo(ctx, async ({ git }) => {
            await fetchOrigin(git);
            return readStatus(git);
        });
    }

    commit(ctx: TServerContext, body: unknown): Promise<TGitCommitResultDto> {
        const { message, push } = parseCommitBody(jsonObjectBody(body));
        return this.withRepo(ctx, async ({ git, current }) => {
            const commit = await commitAll(git, message, current.record);
            if (commit === null) throw HttpError.of('git_nothing_to_commit', 'There are no changes to commit');
            const pushError = push ? await this.tryPush(git) : undefined;
            return {
                commit,
                pushed: push && pushError === undefined,
                ...(pushError && { pushError }),
                status: await readStatus(git),
            };
        });
    }

    push(ctx: TServerContext): Promise<TGitStatusDto> {
        return this.withRepo(ctx, async ({ git }) => {
            if ((await readStatus(git)).detached) throw HttpError.badRequest('Switch to a branch before you push');
            await pushHead(git);
            return readStatus(git);
        });
    }

    pull(ctx: TServerContext): Promise<TGitPullResultDto> {
        return this.withRepo(ctx, async ({ git, current }) => {
            const before = await readStatus(git);
            requireClean(before, 'pull');
            const { upstream } = before;
            if (upstream === null) {
                throw HttpError.badRequest(`Branch "${before.branch}" tracks no remote branch: push it first`);
            }
            const from = await this.head(git);
            await fetchOrigin(git);
            await rewriteInBulk(ctx.bus, () => mergeNoEdit(git, upstream, current.record));
            const to = await this.head(git);
            if (from !== to) await this.afterContentChange(ctx);
            return { updated: from !== to, from, to, status: await readStatus(git) };
        });
    }

    checkout(ctx: TServerContext, body: unknown): Promise<TGitStatusDto> {
        const { branch, create } = parseCheckoutBody(jsonObjectBody(body));
        return this.withRepo(ctx, async ({ git }) => {
            await checkBranchName(git, branch);
            requireClean(await readStatus(git), 'switch branches');
            const refs = await readRefs(git);
            if (create) {
                if (refs.localBranches.includes(branch)) throw HttpError.exists(`Branch "${branch}" exists`);
                await git.run(['switch', '-q', '-c', branch]);
                return readStatus(git);
            }
            const args = switchArgs(branch, refs);
            await rewriteInBulk(ctx.bus, () => git.run(['switch', '-q', ...args]));
            await this.afterContentChange(ctx);
            return readStatus(git);
        });
    }

    log(ctx: TServerContext, query: unknown): Promise<TGitLogEntryDto[]> {
        const { limit, before } = parseLogQuery(query);
        return this.withRepo(ctx, async ({ git }) => {
            const start = await resolveCommit(git, before ?? 'HEAD');
            if (start === null) {
                if (before !== null) throw HttpError.notFound(`No commit "${before}"`);
                return [];
            }
            const skip = before === null ? [] : ['--skip=1'];
            return parseLog(await git.text(['log', LOG_FORMAT, '--name-only', `-n${limit}`, ...skip, start, '--']));
        });
    }

    // the story's files changed in bulk (pull, checkout, setup from the repo): always reloaded, since the change may
    // bring another tsconfig.json or an older layout (setup also swaps the folder under the watcher)
    private async afterContentChange(ctx: TServerContext): Promise<void> {
        await this.contexts.reload(ctx.storyId);
        await this.syncMapSize(ctx);
        ctx.bus.emitStory({ type: 'story', reason: 'git' });
    }

    private async setupPush(ctx: TServerContext, input: TSetupInput, record: TStoryGitRecord): Promise<void> {
        const git = this.runner(ctx.project.root, input.token);
        const created = !(await exists(gitDir(git)));
        try {
            if (created) await git.run(['init', '-q', '-b', input.branch]);
            const gitignore = path.join(ctx.project.root, GITIGNORE_FILE);
            if (!(await exists(gitignore))) await writeFile(gitignore, STORY_GITIGNORE);
            await setOrigin(git, input.remoteUrl);
            await commitAll(git, INITIAL_COMMIT_MESSAGE, input);
            await this.firstPush(git, input.branch);
            await this.rows.insert(ctx.storyId, record);
        } catch (e) {
            if (created) await rm(gitDir(git), { recursive: true, force: true });
            throw e;
        }
    }

    private async firstPush(git: GitRunner, branch: string): Promise<void> {
        try {
            await pushHead(git, branch);
        } catch (e) {
            if (isHttpError(e) && e.body.error === 'git_rejected') {
                throw HttpError.of(
                    'git_rejected',
                    `The remote branch "${branch}" already has commits: set up with "pull" instead`
                );
            }
            throw e;
        }
    }

    private async setupPull(ctx: TServerContext, input: TSetupInput, record: TStoryGitRecord): Promise<void> {
        const tmp = await this.folders.makeTemp('git-setup');
        try {
            const git = this.runner(tmp, input.token);
            await git.run(['init', '-q', '-b', input.branch]);
            await git.run(['remote', 'add', 'origin', input.remoteUrl]);
            await fetchOrigin(git);
            const remoteBranch = `origin/${input.branch}`;
            if ((await resolveCommit(git, remoteBranch)) === null) {
                throw HttpError.badRequest(`The remote has no branch "${input.branch}"`);
            }
            await git.run(['reset', '-q', '--hard', remoteBranch]);
            await git.run(['branch', '-q', `--set-upstream-to=${remoteBranch}`]);
            await checkStoryTree(tmp, 'repo', SETUP_ROOT_EXTRAS);
            await this.rows.exclusive(async (manager) => {
                await this.rows.insert(ctx.storyId, record, manager);
                await rewriteInBulk(ctx.bus, () => this.folders.replace(ctx.storyId, tmp));
            });
        } finally {
            await rm(tmp, { recursive: true, force: true });
        }
        await this.afterContentChange(ctx);
    }

    private async syncMapSize(ctx: TServerContext): Promise<void> {
        const size = await this.mapSizeOnDisk(ctx);
        if (size === null) return;
        await this.stories.exclusive(async (manager) => {
            const current = await this.stories.readVersioned(ctx.storyId, manager);
            if (!current) return;
            const { width, height } = current.file.mapSize;
            if (width === size.width && height === size.height) return;
            await this.stories.write(ctx.storyId, { ...current.file, mapSize: size }, current.version, manager);
        });
    }

    // a missing or invalid map keeps the stored size
    private async mapSizeOnDisk(ctx: TServerContext) {
        try {
            return storyMapSize(await readFile(ctx.project.paths.map), 'story');
        } catch (e) {
            if (isMissingFileError(e) || isHttpError(e)) return null;
            throw e;
        }
    }

    private async tryPush(git: GitRunner) {
        try {
            await pushHead(git);
            return undefined;
        } catch (e) {
            if (isHttpError(e)) return e.body;
            throw e;
        }
    }

    private async head(git: GitRunner): Promise<string> {
        const head = await resolveCommit(git, 'HEAD');
        if (head === null) throw HttpError.badRequest('The repository has no commits yet');
        return head;
    }

    private enabledFor(storyId: string): boolean {
        return this.availability.available && !this.options.disabledStories.includes(storyId);
    }

    private key(storyId: string): Buffer {
        if (this.options.disabledStories.includes(storyId)) {
            throw HttpError.of('git_unavailable', `Git is disabled for story "${storyId}"`);
        }
        const key = this.availability.tokenKey;
        if (key === null) {
            throw HttpError.of('git_unavailable', 'Git is not available on this server (GIT_TOKEN_KEY or git missing)');
        }
        return key;
    }

    private token(key: Buffer, record: TStoryGitRecord): string | null {
        if (record.tokenEncrypted === null) return null;
        try {
            return decryptToken(key, record.tokenEncrypted);
        } catch (e) {
            if (e instanceof TokenCipherError) {
                throw HttpError.of('git_auth', `${e.message}: enter the token again in the git settings`);
            }
            throw e;
        }
    }

    private runner(cwd: string, token: string | null): GitRunner {
        return new GitRunner({ cwd, token, allowFileRemotes: this.options.allowFileRemotes });
    }

    private async configured(storyId: string): Promise<TVersionedStoryGit> {
        const current = await this.rows.read(storyId);
        if (!current) throw notConfigured(storyId);
        return current;
    }

    // stale before invalid: the version is what the change was based on
    private async versioned(ctx: TServerContext, version: unknown): Promise<TVersionedStoryGit> {
        const current = await this.configured(ctx.storyId);
        if (version !== current.version) throw await this.stale(ctx);
        return current;
    }

    private async stale(ctx: TServerContext): Promise<HttpError> {
        return HttpError.stale(await this.gitDto(ctx), 'The git settings changed');
    }

    private withRepo<T>(ctx: TServerContext, fn: (repo: TRepo) => Promise<T>): Promise<T> {
        const key = this.key(ctx.storyId);
        return this.locks.run(ctx.storyId, async () => {
            const current = await this.configured(ctx.storyId);
            const git = this.runner(ctx.project.root, this.token(key, current.record));
            if (!(await exists(gitDir(git)))) {
                throw HttpError.of('git_not_configured', 'The story has no .git folder: disconnect and set up again');
            }
            return fn({ git, current });
        });
    }

    private async gitDto(ctx: TServerContext): Promise<TGitDto> {
        const current = await this.rows.read(ctx.storyId);
        if (!current) return { available: true, config: null, status: null };
        const git = this.runner(ctx.project.root, null);
        const status = (await exists(gitDir(git))) ? await readStatus(git) : null;
        return { available: true, config: configDto(current), status };
    }
}
