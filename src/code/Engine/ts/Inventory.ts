import { TWorldState } from 'data/TWorldState';
import { TCharacterId } from 'types/TIds';
import { TItem, TItemId } from 'types/TItem';
import { Engine } from './Engine';

export class Inventory {
    constructor(private s: TWorldState, private e: Engine) {}

    getInventory = (charId: TCharacterId = this.e.activePassage.characterId) => {
        return this.s.characters[charId].inventory;
    };

    getItem = (id: TItemId, charId: TCharacterId = this.e.activePassage.characterId) => {
        return this.getInventory(charId).find((k) => k.id === id);
    };

    addItem = (item: TItem<TItemId>, charId: TCharacterId = this.e.activePassage.characterId) => {
        const itemInInv = this.getItem(item.id, charId);
        if (!itemInInv) {
            this.getInventory().push(item);
        } else {
            itemInInv.count += item.count;
        }
    };

    getItemCount = (id: TItemId, charId: TCharacterId = this.e.activePassage.characterId) => {
        const itemInInv = this.getItem(id, charId);
        return itemInInv?.count ?? 0;
    };

    removeItem = (
        item: { id: TItemId; count: number },
        charId: TCharacterId = this.e.activePassage.characterId
    ) => {
        const itemInInv = this.getItem(item.id, charId);
        if (itemInInv) {
            if (itemInInv.count <= item.count) {
                this.s.characters[charId].inventory = this.getInventory(charId).filter(
                    (i) => i.id !== item.id
                );
                return;
            }
            itemInInv.count -= item.count;
        }
    };
}
