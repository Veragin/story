import { action, makeObservable, observable, runInAction } from 'mobx';
import type {
    TCreateStoryBody,
    TStoryDto,
    TStoryInfoDto,
    TStoryListItemDto,
    TUpdateStoryBody,
} from '@story/visualizer-protocol';
import { errorMessage, isApiError, type TLandingApi } from './api';
import { engineUrl, exportUrl, visualizerUrl } from './links';

export class StoriesStore {
    stories: TStoryListItemDto[] = [];
    loaded = false;
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

    async play(id: string) {
        const story = this.story(id);
        if (story?.public || (await this.requireUnlocked(id))) this.navigate(engineUrl(id));
    }

    async exportStory(id: string) {
        if (await this.requireUnlocked(id)) this.navigate(exportUrl(id));
    }

    async create(body: TCreateStoryBody): Promise<TStoryDto> {
        const story = await this.api.createStory(body);
        await this.load();
        return story;
    }

    async importZip(zip: Blob, id: string): Promise<TStoryDto> {
        const story = await this.api.importStory(zip, id);
        await this.load();
        return story;
    }

    loadInfo(id: string): Promise<TStoryInfoDto | null> {
        return this.withGrant(id, () => this.api.getStoryInfo(id));
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
