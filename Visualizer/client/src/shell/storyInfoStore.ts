import { makeObservable, observable, runInAction } from 'mobx';
import type { TStoryInfoDto } from '@story/visualizer-protocol';
import { api as defaultApi, type TVisualizerApi } from '../api';

/**
 * The edited story's info (`GET /info`: name, author, `mapSize`, …) for the top bar. Loaded once
 * by the top bar; a 401 waits for the login like every request.
 */
export class StoryInfoStore {
    info: TStoryInfoDto | null = null;
    private loading: Promise<void> | null = null;

    constructor(private readonly api: TVisualizerApi = defaultApi) {
        makeObservable(this, { info: observable.ref });
    }

    load = (): Promise<void> => {
        this.loading ??= this.api
            .getStoryInfo()
            .then((info) => {
                runInAction(() => (this.info = info));
                // two tabs on two stories are told apart by their title
                document.title = `${info.name} · Visualizer`;
            })
            .catch((e: unknown) => {
                this.loading = null;
                console.error('[shell] could not load the story info', e);
            });
        return this.loading;
    };
}

export const storyInfo = new StoryInfoStore();
