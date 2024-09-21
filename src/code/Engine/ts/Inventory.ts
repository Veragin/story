import { TWorldState } from 'data/TWorldState';
import { TCharacterId } from 'types/TCharacter';
import { TItem, TItemId } from 'types/TItem';

export class Inventory {
    constructor(private s: TWorldState) {}

    getInventory = (charId: TCharacterId = this.s.mainCharacterId) => {
        return this.s.characters[charId].inventory;
    };

    getItem = (id: TItemId, charId: TCharacterId = this.s.mainCharacterId) => {
        return this.getInventory(charId).find((k) => k.id === id);
    };

    addItem = (item: TItem<TItemId>, charId: TCharacterId = this.s.mainCharacterId) => {
        const itemInInv = this.getItem(item.id, charId);
        if (!itemInInv) {
            this.getInventory().push(item);
        } else {
            itemInInv.count += item.count;
        }
    };

    getItemCount = (id: TItemId, charId: TCharacterId = this.s.mainCharacterId) => {
        const itemInInv = this.getItem(id, charId);
        return itemInInv?.count ?? 0;
    };

    removeItem = (
        item: { id: TItemId; count: number },
        charId: TCharacterId = this.s.mainCharacterId
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
