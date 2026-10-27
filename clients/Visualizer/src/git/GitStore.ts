import { action, computed, makeObservable, observable, runInAction } from 'mobx';
import type {
    TApiErrorCode,
    TGitBranchDto,
    TGitCommitResultDto,
    TGitConfigDto,
    TGitDto,
    TGitPullResultDto,
    TGitStatusDto,
    TSetupGitBody,
    TUpdateGitConfigBody,
} from '@story/protocol';
import { ApiError, errorBodyMessage, errorMessage, type ApiEvents, type TVisualizerApi } from '../api';
import type { AuthStore } from '../api/auth';
import { RefCountedSubscription } from '../stores/RefCountedSubscription';

export type TGitFailure = { ok: false; code: TApiErrorCode | null; message: string; files: string[] };
export type TGitResult<T> = { ok: true; value: T } | TGitFailure;

export type TGitConfigPatch = Omit<TUpdateGitConfigBody, 'version'>;

type TGitStoreOptions = {
    api: TVisualizerApi;
    events?: ApiEvents;
    auth?: Pick<AuthStore, 'onLogin'>;
    fetchThrottleMs?: number;
    refreshDelayMs?: number;
    now?: () => number;
};

export const GIT_FETCH_THROTTLE_MS = 30_000;
const REFRESH_DELAY_MS = 1000;

const UNAVAILABLE: TGitDto = { available: false, config: null, status: null };

export const gitFailure = (e: unknown): TGitFailure => ({
    ok: false,
    code: e instanceof ApiError ? e.code : null,
    message: errorMessage(e),
    files: e instanceof ApiError ? (e.body.files ?? []) : [],
});

const notConfigured = (): TGitFailure => ({
    ok: false,
    code: 'git_not_configured',
    message: errorBodyMessage({ error: 'git_not_configured' }),
    files: [],
});

export class GitStore {
    canEdit = false;
    dto: TGitDto | null = null;
    branches: TGitBranchDto[] | null = null;
    busy = false;
    lastError: string | null = null;

    private readonly api: TVisualizerApi;
    private readonly events?: ApiEvents;
    private readonly auth?: Pick<AuthStore, 'onLogin'>;
    private readonly fetchThrottleMs: number;
    private readonly refreshDelayMs: number;
    private readonly now: () => number;
    private readonly subscription: RefCountedSubscription;
    private lastFetchAt: number | null = null;
    private refreshTimer: ReturnType<typeof setTimeout> | null = null;
    private loadToken = 0;
    private branchesRequest = 0;

    constructor({
        api,
        events,
        auth,
        fetchThrottleMs = GIT_FETCH_THROTTLE_MS,
        refreshDelayMs = REFRESH_DELAY_MS,
        now = Date.now,
    }: TGitStoreOptions) {
        this.api = api;
        this.events = events;
        this.auth = auth;
        this.fetchThrottleMs = fetchThrottleMs;
        this.refreshDelayMs = refreshDelayMs;
        this.now = now;
        this.subscription = new RefCountedSubscription(() => this.subscribe());
        makeObservable<GitStore, 'setStatus'>(this, {
            canEdit: observable,
            dto: observable.ref,
            branches: observable.ref,
            busy: observable,
            lastError: observable,
            available: computed,
            config: computed,
            status: computed,
            configured: computed,
            changeCount: computed,
            dirty: computed,
            canPush: computed,
            refsKey: computed,
            clearError: action,
            setStatus: action,
        });
    }

    get available(): boolean {
        return this.canEdit && this.dto?.available === true;
    }

    get config(): TGitConfigDto | null {
        return this.dto?.config ?? null;
    }

    get status(): TGitStatusDto | null {
        return this.dto?.status ?? null;
    }

    get configured(): boolean {
        return this.config !== null;
    }

    get changeCount(): number {
        return this.status?.changes.length ?? 0;
    }

    get dirty(): boolean {
        return this.changeCount > 0;
    }

    get canPush(): boolean {
        return (this.status?.ahead ?? 0) > 0 && !this.dirty;
    }

    // changes whenever a branch tip or the branch list may have moved
    get refsKey(): string {
        const status = this.status;
        if (!status) return '';
        const { branch, head, localBranches, remoteBranches, lastFetchedAt } = status;
        return JSON.stringify([branch, head?.hash, localBranches, remoteBranches, lastFetchedAt]);
    }

    start = (): (() => void) => this.subscription.acquire();

    clearError = () => {
        this.lastError = null;
    };

    load = async (): Promise<void> => {
        const token = ++this.loadToken;
        try {
            const access = await this.api.getStoryAccess();
            const dto = access.canEdit ? await this.api.getGit() : null;
            if (token !== this.loadToken) return;
            runInAction(() => {
                this.canEdit = access.canEdit;
                this.dto = dto;
            });
        } catch (e) {
            if (token !== this.loadToken) return;
            runInAction(() => {
                if (e instanceof ApiError && e.code === 'git_unavailable') this.dto = UNAVAILABLE;
                else this.lastError = errorMessage(e);
            });
        }
    };

    refresh = async (): Promise<void> => {
        if (!this.canEdit) return;
        const token = ++this.loadToken;
        try {
            const dto = await this.api.getGit();
            if (token === this.loadToken) runInAction(() => (this.dto = dto));
        } catch (e) {
            console.error('[git] could not refresh the status', e);
        }
    };

    scheduleRefresh = () => {
        if (!this.configured) return;
        this.cancelRefresh();
        this.refreshTimer = setTimeout(() => {
            this.refreshTimer = null;
            if (this.busy) this.scheduleRefresh();
            else void this.refresh();
        }, this.refreshDelayMs);
    };

    fetch = async ({ force = false } = {}): Promise<void> => {
        if (!this.configured) return;
        const now = this.now();
        if (!force && this.lastFetchAt !== null && now - this.lastFetchAt < this.fetchThrottleMs) return;
        this.lastFetchAt = now;
        try {
            this.setStatus(await this.api.gitFetch());
        } catch (e) {
            runInAction(() => (this.lastError = errorMessage(e)));
        }
    };

    commit = async (message: string, push: boolean): Promise<TGitResult<TGitCommitResultDto>> => {
        const result = await this.run(
            () => this.api.gitCommit({ message, push }),
            (value) => this.setStatus(value.status)
        );
        const pushError = result.ok ? result.value.pushError : undefined;
        if (pushError) runInAction(() => (this.lastError = errorBodyMessage(pushError)));
        return result;
    };

    push = (): Promise<TGitResult<TGitStatusDto>> =>
        this.run(
            () => this.api.gitPush(),
            (status) => this.setStatus(status)
        );

    forcePush = (): Promise<TGitResult<TGitStatusDto>> =>
        this.run(
            () => this.api.gitForcePush(),
            (status) => this.setStatus(status)
        );

    pull = (): Promise<TGitResult<TGitPullResultDto>> =>
        this.run(
            () => this.api.gitPull(),
            (value) => this.setStatus(value.status)
        );

    pullThenPush = async (): Promise<TGitResult<TGitStatusDto>> => {
        const pulled = await this.pull();
        return pulled.ok ? this.push() : pulled;
    };

    checkout = (branch: string, create: boolean): Promise<TGitResult<TGitStatusDto>> =>
        this.run(
            () => this.api.gitCheckout({ branch, create }),
            (status) => this.setStatus(status)
        );

    discard = (): Promise<TGitResult<TGitStatusDto>> =>
        this.run(
            () => this.api.gitDiscard(),
            (status) => this.setStatus(status)
        );

    deleteBranch = (branch: string, remote: boolean): Promise<TGitResult<TGitStatusDto>> =>
        this.run(
            () => this.api.deleteGitBranch({ branch, remote }),
            (status) => this.setStatus(status)
        );

    loadBranches = async (): Promise<TGitResult<TGitBranchDto[]>> => {
        const request = ++this.branchesRequest;
        try {
            const branches = await this.api.getGitBranches();
            if (request === this.branchesRequest) runInAction(() => (this.branches = branches));
            return { ok: true, value: branches };
        } catch (e) {
            return gitFailure(e);
        }
    };

    setup = (body: TSetupGitBody): Promise<TGitResult<TGitDto>> =>
        this.run(
            () => this.api.setupGit(body),
            (dto) => (this.dto = dto)
        );

    saveConfig = (patch: TGitConfigPatch): Promise<TGitResult<TGitDto>> => {
        const version = this.config?.version;
        if (version === undefined) return Promise.resolve(notConfigured());
        return this.run(
            () => this.api.updateGitConfig({ ...patch, version }),
            (dto) => (this.dto = dto)
        );
    };

    disconnect = (removeRepo: boolean): Promise<TGitResult<void>> => {
        const version = this.config?.version;
        if (version === undefined) return Promise.resolve(notConfigured());
        return this.run(
            () => this.api.deleteGitConfig({ version, removeRepo }),
            () => (this.dto = { available: true, config: null, status: null })
        );
    };

    private run = async <T>(call: () => Promise<T>, apply: (value: T) => void): Promise<TGitResult<T>> => {
        runInAction(() => {
            this.busy = true;
            this.lastError = null;
        });
        try {
            const value = await call();
            runInAction(() => apply(value));
            return { ok: true, value };
        } catch (e) {
            const failure = gitFailure(e);
            runInAction(() => (this.lastError = failure.message));
            // a refusal (dirty, stale, rejected) often means the shown status is out of date
            void this.refresh();
            return failure;
        } finally {
            runInAction(() => (this.busy = false));
        }
    };

    private setStatus(status: TGitStatusDto) {
        if (this.dto) this.dto = { ...this.dto, status };
    }

    private cancelRefresh() {
        if (this.refreshTimer) clearTimeout(this.refreshTimer);
        this.refreshTimer = null;
    }

    private subscribe() {
        void this.load();
        const offs = [() => this.cancelRefresh()];
        if (this.events) {
            offs.push(
                this.events.onResync(() => void this.load()),
                this.events.onWrite(this.scheduleRefresh),
                this.events.subscribe('*', this.scheduleRefresh)
            );
        }
        if (this.auth) offs.push(this.auth.onLogin(() => void this.load()));
        return offs;
    }
}
