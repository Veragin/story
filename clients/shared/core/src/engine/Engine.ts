import type { TWorldState } from '@story/data';
import { Inventory } from './Inventory';
import { keysOf, showToast, TimeManager } from '@story/shared';
import { TChapterId, TChapterPassage } from '@story/types';
import { createDummyPassage } from './const';
import { History } from './History';
import { Processor } from './Processor';
import { Story } from './Story';
import { Store } from './Store';
import { makeAutoObservable, runInAction } from 'mobx';
import { loadWorldState } from '../worldState/loadWorldState';
import type { TStoryModule } from '../worldState/buildWorldState';

export class Engine {
    inventory: Inventory;
    history: History;
    processor: Processor;
    story: Story;
    timeManager: TimeManager;

    activePassage: TChapterPassage<TChapterId>;
    store: Store;

    constructor(
        private s: TWorldState,
        readonly storyModule: TStoryModule,
        readonly storyId: string
    ) {
        makeAutoObservable(s);

        this.loadStateFromLocalStorage();

        this.activePassage = createDummyPassage(keysOf(storyModule.register.chapters)[0], s.mainCharacterId);

        this.timeManager = new TimeManager();
        this.store = new Store(s);
        this.inventory = new Inventory(s, this);
        this.history = new History(s, this);
        this.story = new Story(s, this);
        this.processor = new Processor(s, this);
    }

    handleAutoStart = async () => {
        if (Object.keys(this.s.currentHistory).length !== 0) {
            const startState = JSON.stringify(this.s);
            await this.processor.continue();
            this.setWorldState(startState);
        }
    };

    saveStateToLocalStorage = () => {
        showToast(_('Game was saved'), { variant: 'success' });
        localStorage.setItem(this.localStorageKey, JSON.stringify(this.s));
    };

    clearStateFromLocalStorage = () => {
        localStorage.removeItem(this.localStorageKey);
    };

    private loadStateFromLocalStorage = () => {
        const data = localStorage.getItem(this.localStorageKey);
        if (data !== null) {
            this.setWorldState(data);
        }
    };

    private get localStorageKey() {
        return `${LOCAL_STORAGE_KEY_PREFIX}:${this.storyId}`;
    }

    private setWorldState = (state: string) => {
        const worldState = loadWorldState(state);
        // assigned key by key: observers hold the original object
        runInAction(() => {
            keysOf(worldState).forEach((key) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                this.s[key] = worldState[key] as any;
            });
        });
    };
}

const LOCAL_STORAGE_KEY_PREFIX = 'worldState';
