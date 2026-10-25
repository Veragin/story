import { action, makeObservable, observable, runInAction } from 'mobx';
import type {
    TCreateStoryBody,
    TGitDto,
    TImportStoryBody,
    TSetupGitBody,
    TStoryDto,
    TStoryInfoDto,
    TStoryListItemDto,
    TUpdateStoryBody,
} from '@story/protocol';
import { errorMessage, isApiError, type TLandingApi } from './api';
import { engineUrl, exportUrl, exportWebUrl, visualizerUrl } from './links';
import type { TGitChange } from './storyForm';

/** `gitError`: the story was created, connecting it to the repository failed. */
export type TCreateResult = { story: TStoryDto; gitError: string | null };

export class StoriesStore {
    stories: TStoryListItemDto[] = [];
    loaded = false;
    gitAvailable = false;
    error: string | null = null;
    prompt: TStoryDto | null = null;
    private resolvePrompt: ((unlocked: boolean) => void) | null = null;

    constructor(
        readonly api: TLandingApi,
        private readonly navigate: (url: string) => void = (url) => window.location.assign(url)
    ) {
        makeObservable<StoriesStore, 'setUnlocked'>(this, {
            stories: observable.ref,
            loaded: observable,
            gitAvailable: observable,
            error: observable,
            prompt: observable.ref,
            cancelPassword: action,
            setUnlocked: action,
        });
    }

    story(id: string) {
        return this.stories.find((s) => s.id === id);
    }

    isUnlocked(id: string) {
        return this.story(id)?.unlocked ?? false;
    }

    async load() {
        try {
            const stories = await this.api.listStories();
            runInAction(() => {
                this.stories = stories;
                this.loaded = true;
                this.error = null;
            });
        } catch (e) {
            runInAction(() => {
                this.loaded = true;
                this.error = errorMessage(e);
            });
        }
    }

    async checkGit() {
        try {
            const health = await this.api.health();
            runInAction(() => {
                this.gitAvailable = health.git === 'up';
            });
        } catch {
            // without the health answer the git fields stay hidden
        }
    }

    requireUnlocked(id: string): Promise<boolean> {
        if (this.isUnlocked(id)) return Promise.resolve(true);
        const story = this.story(id);
        if (!story) return Promise.resolve(false);
        this.settlePrompt(false);
        return new Promise<boolean>((resolve) => {
            runInAction(() => {
                this.prompt = story;
                this.resolvePrompt = resolve;
            });
        });
    }

    async submitPassword(password: string) {
        const story = this.prompt;
        if (!story) return;
        await this.api.login(story.id, password);
        this.setUnlocked(story.id, true);
        this.settlePrompt(true);
    }

    cancelPassword() {
        this.settlePrompt(false);
    }

    async withGrant<T>(id: string, fn: () => Promise<T>): Promise<T | null> {
        if (!(await this.requireUnlocked(id))) return null;
        try {
            return await fn();
        } catch (e) {
            if (!isApiError(e) || !e.isUnauthorized) throw e;
            // the grant expired since the list was read
            this.setUnlocked(id, false);
            if (!(await this.requireUnlocked(id))) return null;
            return await fn();
        }
    }

    async open(id: string) {
        if (await this.requireUnlocked(id)) this.navigate(visualizerUrl(id));
    }

    // the player asks for a private story's password itself: in production it is another site, with its own session
    play(id: string) {
        this.navigate(engineUrl(id));
    }

    async exportStory(id: string) {
        if (await this.requireUnlocked(id)) this.navigate(exportUrl(id));
    }

    async exportForWeb(id: string) {
        if (await this.requireUnlocked(id)) this.navigate(exportWebUrl(id));
    }

    async create(body: TCreateStoryBody, git: TSetupGitBody | null): Promise<TCreateResult> {
        const story = await this.api.createStory(body);
        await this.load();
        if (!git) return { story, gitError: null };
        try {
            await this.withGrant(story.id, () => this.api.setupGit(story.id, git));
            return { story, gitError: null };
        } catch (e) {
            return { story, gitError: errorMessage(e) };
        }
    }

    async importZip(zip: Blob, body: TImportStoryBody): Promise<TStoryDto> {
        const story = await this.api.importStory(zip, body);
        await this.load();
        return story;
    }

    loadInfo(id: string): Promise<TStoryInfoDto | null> {
        return this.withGrant(id, () => this.api.getStoryInfo(id));
    }

    loadGit(id: string): Promise<TGitDto | null> {
        return this.withGrant(id, () => this.api.getGit(id));
    }

    saveGit(id: string, change: TGitChange): Promise<TGitDto | null> {
        return this.withGrant(id, () =>
            change.kind === 'setup' ? this.api.setupGit(id, change.body) : this.api.updateGitConfig(id, change.body)
        );
    }

    async saveInfo(id: string, body: TUpdateStoryBody): Promise<TStoryInfoDto | null> {
        const info = await this.withGrant(id, () => this.api.updateStoryInfo(id, body));
        if (info) await this.load();
        return info;
    }

    private setUnlocked(id: string, unlocked: boolean) {
        this.stories = this.stories.map((s) => (s.id === id ? { ...s, unlocked } : s));
    }

    private settlePrompt(unlocked: boolean) {
        const resolve = this.resolvePrompt;
        runInAction(() => {
            this.prompt = null;
            this.resolvePrompt = null;
        });
        resolve?.(unlocked);
    }
}
