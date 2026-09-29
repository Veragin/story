import { action, makeObservable, observable, runInAction } from 'mobx';
import type {
    TCreateStoryBody,
    TStoryDto,
    TStoryInfoDto,
    TStoryListItemDto,
    TUpdateStoryBody,
} from '@story/visualizer-protocol';
import { isApiError, type TLandingApi } from './api';
import { engineUrl, exportUrl, visualizerUrl } from './links';

/**
 * The landing page's state: the story list, which stories this browser has unlocked, and the
 * password prompt (multiple stories, phase 6).
 *
 * Every button that needs a story's grant goes through `requireUnlocked(id)`: it resolves `true`
 * right away when the story is unlocked, and otherwise opens the password prompt (`prompt`, shown
 * by `PasswordDialog`) and resolves once the user has logged in (`true`) or cancelled (`false`).
 */
export class StoriesStore {
    stories: TStoryListItemDto[] = [];
    loaded = false;
    error: string | null = null;
    /** The story the password prompt asks for; `null` while the prompt is closed. */
    prompt: TStoryDto | null = null;
    private resolvePrompt: ((unlocked: boolean) => void) | null = null;

    constructor(
        readonly api: TLandingApi,
        /** How a button leaves the page (Open, Play, Export); injected so tests can see it. */
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

    /** (Re)read the list, `unlocked` flags included: at start, after a change, on window focus. */
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
                this.error = (e as Error).message;
            });
        }
    }

    /**
     * Resolves `true` once the story is unlocked: at once if it already is, otherwise after the
     * user logs in through the prompt. `false` when they cancel (or another prompt replaces
     * this one).
     */
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

    /**
     * The prompt's `onSubmit`. Rejects with the `ApiError` of a failed login (401 wrong
     * password, 429 too many attempts): `PasswordDialog` shows it and stays open.
     */
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

    /**
     * Run `fn`, which needs the story's grant: unlock first, and if the server still answers 401
     * (the grant expired since the list was read) mark the story locked, ask again and retry
     * once. `null` when the user cancels the prompt.
     */
    async withGrant<T>(id: string, fn: () => Promise<T>): Promise<T | null> {
        if (!(await this.requireUnlocked(id))) return null;
        try {
            return await fn();
        } catch (e) {
            if (!isApiError(e) || !e.isUnauthorized) throw e;
            this.setUnlocked(id, false);
            if (!(await this.requireUnlocked(id))) return null;
            return await fn();
        }
    }

    /** Open: the Visualizer on the story. */
    async open(id: string) {
        if (await this.requireUnlocked(id)) this.navigate(visualizerUrl(id));
    }

    /** Play as single: SingleEngine. A public story needs no password to play. */
    async play(id: string) {
        const story = this.story(id);
        if (story?.public || (await this.requireUnlocked(id))) this.navigate(engineUrl(id));
    }

    /** Export: the zip download (an attachment, so the page stays). */
    async exportStory(id: string) {
        if (await this.requireUnlocked(id)) this.navigate(exportUrl(id));
    }

    /** Create a story. The server logs the creator in, so it shows up unlocked. */
    async create(body: TCreateStoryBody): Promise<TStoryDto> {
        const story = await this.api.createStory(body);
        await this.load();
        return story;
    }

    /** Import a zip under `id`. Rejects with the `ApiError` (`409 exists` when the id is taken). */
    async importZip(zip: Blob, id: string): Promise<TStoryDto> {
        const story = await this.api.importStory(zip, id);
        await this.load();
        return story;
    }

    /** The Edit dialog's data, behind the grant. `null` when the prompt was cancelled. */
    loadInfo(id: string): Promise<TStoryInfoDto | null> {
        return this.withGrant(id, () => this.api.getStoryInfo(id));
    }

    /** Save the Edit dialog. Rejects with the `ApiError` (`409 stale` carries `current`). */
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
