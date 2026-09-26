import { TimeManager } from '@story/shared';
import { ChapterStore } from '../Chapters/ChapterStore/ChapterStore';
import { action, makeObservable, observable } from 'mobx';
import { CanvasHandler } from './CanvasHandler';
import { Agent } from './Agent';
import { api, type TVisualizerApi } from '../api';
import { ReactNode } from 'react';

export class Store {
    chapterStore: ChapterStore;
    canvasHandler: CanvasHandler;
    /** The typed Visualizer API (`client/src/api`) — real server via the `/api` proxy, or the mock. */
    api: TVisualizerApi = api;
    /** Legacy adapter over `api` for the pre-WP1 forms and map page. */
    agent: Agent;

    constructor(public timeManager: TimeManager) {
        this.agent = new Agent(this.api);
        this.chapterStore = new ChapterStore(timeManager, this);
        this.canvasHandler = new CanvasHandler(document.body, this);

        makeObservable(this, {
            modalContent: observable.ref,
            setModalContent: action,
        });
    }

    updateSize = (width: number, height: number) => {
        this.chapterStore.durationHelper.size.width = width;
        this.chapterStore.durationHelper.size.height = height;

        this.chapterStore.render();
    };

    modalContent: ReactNode | null = null;
    setModalContent = (content: ReactNode | null) => {
        this.modalContent = content;
    };

    destroy = () => {
        this.canvasHandler.destroy();
        this.chapterStore.deinit();
    };
}
