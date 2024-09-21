import { TWorldState } from 'data/TWorldState';
import { Inventory } from './Inventory';
import { TEventPassage } from 'types/TPassage';
import { TEventId } from 'types/TIds';

export class Engine {
    inventory: Inventory;

    activePassage?: TEventPassage<TEventId>;

    constructor(private s: TWorldState) {
        this.inventory = new Inventory(s);
    }
}
