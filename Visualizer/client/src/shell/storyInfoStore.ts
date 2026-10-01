import { makeObservable, observable, runInAction } from 'mobx';
import type { TStoryInfoDto } from '@story/visualizer-protocol';
import { api as defaultApi, type TVisualizerApi } from '../api';

export class StoryInfoStore {
    info: TStoryInfoDto | null = null;
    private loading: Promise<void> | null = null;

    constructor(private readonly api: TVisualizerApi = defaultApi) {
        makeObservable(this, { info: observable.ref });
    }

    load = (): Promise<void> => {
        this.loading ??= this.fetchInfo();
        return this.loading;
    };

    private fetchInfo = async () => {
        try {
            const info = await this.api.getStoryInfo();
            runInAction(() => (this.info = info));
            document.title = `${info.name} · Visualizer`;
        } catch (e: unknown) {
            this.loading = null;
            console.error('[shell] could not load the story info', e);
        }
    };
}

export const storyInfo = new StoryInfoStore();
