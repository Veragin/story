import { TWorldState } from 'data/TWorldState';
import { Inventory } from './Inventory';
import { TEventPassage } from 'types/TPassage';
import { TEventId } from 'types/TIds';
import { DUMMY_PASSAGE } from './const';
import { History } from './History';
import { Processor } from './Processor';
import { Story } from './Story';
import { Store } from './Store';
import { TimeManager } from 'time/TimeManager';
import { makeAutoObservable, runInAction } from 'mobx';
import { loadWorldState } from 'code/utils/loadWorldState';
import { showToast } from 'code/GlobalWrapper';

export class Engine {
    inventory: Inventory;
    history: History;
    processor: Processor;
    story: Story;
    timeManager: TimeManager;

    activePassage: TEventPassage<TEventId> = DUMMY_PASSAGE;
    store: Store;

    constructor(private s: TWorldState) {
        makeAutoObservable(s);

        this.loadStateFromLocalStorage();

        this.timeManager = new TimeManager();
        this.store = new Store(s);
        this.inventory = new Inventory(s, this);
        this.history = new History(s);
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
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(this.s));
    };

    clearStateFromLocalStorage = () => {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
    };

    private loadStateFromLocalStorage = () => {
        const data = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (data !== null) {
            this.setWorldState(data);
        }
    };

    private setWorldState = (state: string) => {
        const worldState = loadWorldState(state);
        // we have to keep the reference to the object
        runInAction(() => {
            (Object.keys(worldState) as (keyof TWorldState)[]).forEach((key) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                this.s[key] = worldState[key] as any;
            });
        });
    };
}

const LOCAL_STORAGE_KEY = 'worldState';
