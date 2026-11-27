import type { TWorldState } from '@story/data';
import { TLocationId } from './Location';
import { TItem, TItemId, TInitInventory } from './TItem';
import { TCharacterId, TCharacterPassageId } from './ids';

export class Character<Ch extends TCharacterId> {
    declare id: Ch;
    declare name: string;
    declare description?: string;
    declare image?: string;

    declare startPassageId?: TCharacterPassageId<Ch>;
    declare init: Omit<TWorldState['characters'][Ch], 'inventory' | 'ref'> & TInitInventory;
}

export type TCharacterData = {
    location?: TLocationId;
    health: number;
    inventory: TItem<TItemId>[];
};
