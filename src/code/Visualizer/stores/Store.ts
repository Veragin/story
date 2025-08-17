import { TimeManager } from 'time/TimeManager';
import { ChapterStore } from '../Chapters/ChapterStore/ChapterStore';
import { action, makeObservable, observable } from 'mobx';
import { TChapterId } from 'types/TIds';
import { CanvasHandler } from './CanvasHandler';
import { Agent } from './Agent';
import { ReactNode } from 'react';

export class Store {
    chapterStore: ChapterStore;
    canvasHandler: CanvasHandler;
    agent: Agent;

    constructor(public timeManager: TimeManager) {
        this.agent = new Agent('http://localhost:3123');
        this.chapterStore = new ChapterStore(timeManager, this);
        this.canvasHandler = new CanvasHandler(document.body, this);

        makeObservable(this, {
            activeTab: observable,
            modalContent: observable.ref,
            setActiveTab: action,
            setModalContent: action,
        });
    }

    activeTab: TActiveTab = null;
    setActiveTab = (tab: TActiveTab | null) => {
        this.activeTab = tab;
        this.modalContent = null;
    };

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

type TActiveTab =
    | null
    | {
          tab: 'chapter';
          chapterId: TChapterId;
      }
    | {
          tab: 'map';
          mapId: string;
      };
