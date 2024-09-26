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
import { makeAutoObservable } from 'mobx';

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

        this.timeManager = new TimeManager();
        this.store = new Store(s);
        this.inventory = new Inventory(s, this);
        this.history = new History(s);
        this.story = new Story(s, this);
        this.processor = new Processor(s, this);

        this.handleAutoStart();
    }

    handleAutoStart = () => {
        if (this.s.currentHistory !== null) {
            this.processor.continue();
        }
    };
}
