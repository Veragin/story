import { TWorldState } from 'data/TWorldState';
import { Inventory } from './Inventory';

export class Engine {
    inventory: Inventory;

    constructor(private s: TWorldState) {
        this.inventory = new Inventory(s);
    }
}
