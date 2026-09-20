import type { TWorldState } from '@story/data';
import { TCharacterId, TItemId, TItemPartial } from '@story/types';
import { Engine } from './Engine';
import { itemInfo } from '@story/data';

export class Inventory {
    constructor(
        private s: TWorldState,
        private e: Engine
    ) {}

    getInventory = (charId: TCharacterId = this.e.activePassage.characterId) => {
        return this.s.characters[charId].inventory;
    };

    getItem = (id: TItemId, charId: TCharacterId = this.e.activePassage.characterId) => {
        return this.getInventory(charId).find((k) => k.id === id);
    };

    addItem = (item: TItemPartial<TItemId>, charId: TCharacterId = this.e.activePassage.characterId) => {
        const itemInInv = this.getItem(item.id, charId);
        if (!itemInInv) {
            this.getInventory().push({ ...itemInfo[item.id], amount: 1, ...item });
        } else {
            itemInInv.amount += item.amount ?? 1;
        }
    };

    getItemAmount = (id: TItemId, charId: TCharacterId = this.e.activePassage.characterId) => {
        const itemInInv = this.getItem(id, charId);
        return itemInInv?.amount ?? 0;
    };

    removeItem = (item: { id: TItemId; amount: number }, charId: TCharacterId = this.e.activePassage.characterId) => {
        const itemInInv = this.getItem(item.id, charId);
        if (itemInInv) {
            if (itemInInv.amount <= item.amount) {
                this.s.characters[charId].inventory = this.getInventory(charId).filter((i) => i.id !== item.id);
                return;
            }
            itemInInv.amount -= item.amount;
        }
    };
}
