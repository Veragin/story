import type { TWorldState } from '@story/data';
import { TLocationId } from './Location';
import { TItem, TItemId, TInitInventory } from './TItem';
import { TNpcId } from './ids';

export class Npc<Ch extends TNpcId> {
    declare id: Ch;
    declare name: string;
    declare description: string;
    declare image?: string;

    declare init: Omit<TWorldState['npcs'][Ch], 'inventory' | 'ref'> & TInitInventory;
}

export type TNpcData = {
    location: TLocationId | undefined;
    inventory: TItem<TItemId>[];
    isDead: boolean;
};
