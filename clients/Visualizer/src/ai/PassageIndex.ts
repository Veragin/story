import { action, computed, makeObservable, observable, runInAction } from 'mobx';
import type { TPassageDto } from '@story/protocol';
import { displayText, type ApiEvents, type TVisualizerApi } from '../api';
import type { EntityStore } from '../stores/EntityStore';
import type { TPassageEntry, TPassageSource } from './aiMentions';

export type TChapterPassages = {
    readonly passages: readonly TPassageDto[];
};

export type TPassageIndex = TPassageSource & {
    attachChapter: (chapter: TChapterPassages) => () => void;
};

type TPassageIndexOptions = {
    api: TVisualizerApi;
    events?: ApiEvents;
    entities?: Pick<EntityStore, 'project'>;
};

const toEntry = (passage: TPassageDto): TPassageEntry => ({
    id: passage.passageId,
    title: 'title' in passage ? displayText(passage.title, passage.passageId) : passage.passageId,
    chapterId: passage.chapterId,
});

export class PassageIndex implements TPassageIndex {
    fetching = false;

    private attached: TChapterPassages | null = null;
    private cache: TPassageEntry[] | null = null;
    private stale = false;
    private generation = 0;
    private subscribed = false;

    private readonly api: TVisualizerApi;
    private readonly events?: ApiEvents;
    private readonly entities?: Pick<EntityStore, 'project'>;

    constructor({ api, events, entities }: TPassageIndexOptions) {
        this.api = api;
        this.events = events;
        this.entities = entities;
        makeObservable<PassageIndex, 'attached' | 'cache' | 'invalidate'>(this, {
            fetching: observable,
            attached: observable.ref,
            cache: observable.ref,
            inChapter: computed,
            passages: computed,
            loading: computed,
            attachChapter: action,
            invalidate: action,
        });
    }

    get inChapter(): boolean {
        return this.attached !== null;
    }

    get passages(): readonly TPassageEntry[] {
        if (this.attached) return this.attached.passages.map(toEntry);
        return this.cache ?? [];
    }

    get loading(): boolean {
        return !this.inChapter && this.fetching;
    }

    attachChapter = (chapter: TChapterPassages): (() => void) => {
        this.attached = chapter;
        return action(() => {
            if (this.attached === chapter) this.attached = null;
        });
    };

    load = () => {
        if (this.attached || this.fetching || (this.cache && !this.stale)) return;
        this.subscribe();
        void this.fetchAll();
    };

    private async fetchAll() {
        const generation = this.generation;
        runInAction(() => (this.fetching = true));
        try {
            const project = this.entities?.project ?? (await this.api.getProject());
            const lists = await Promise.all(
                project.chapters.map((c) => this.api.listChapterPassages(c.id).catch(() => null))
            );
            const entries = lists.flatMap((list) => list?.passages.map(toEntry) ?? []);
            runInAction(() => {
                this.cache = entries;
                this.stale = generation !== this.generation;
            });
        } catch (e) {
            console.error('[ai] could not list the passages', e);
        } finally {
            runInAction(() => (this.fetching = false));
        }
    }

    private invalidate = () => {
        this.generation++;
        this.stale = true;
    };

    private subscribe() {
        if (this.subscribed || !this.events) return;
        this.subscribed = true;
        this.events.subscribe('passage', this.invalidate);
        this.events.subscribe('chapter', this.invalidate);
        this.events.onResync(this.invalidate);
        this.events.onWrite(this.invalidate);
    }
}
