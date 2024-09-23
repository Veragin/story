import { TWorldState } from 'data/TWorldState';
import { Inventory } from './Inventory';
import { TEventPassage } from 'types/TPassage';
import { TEventId } from 'types/TIds';
import { DUMMY_PASSAGE } from './const';
import { History } from './History';
import { Processor } from './Processor';
import { Story } from './Story';
import { Store } from './Store';

export class Engine {
    inventory: Inventory;
    history: History;
    processor: Processor;
    story: Story;

    activePassage: TEventPassage<TEventId> = DUMMY_PASSAGE;
    store = new Store();

    constructor(private s: TWorldState) {
        this.inventory = new Inventory(s, this);
        this.history = new History(s);
        this.processor = new Processor(s, this);
        this.story = new Story(s, this);
    }
}
