import type { TWorldState } from '@story/data';
import { TLocationId } from './TLocation';
import { TItem, TItemId, TInitInventory } from './TItem';
import { TCharacterId, TCharacterPassageId } from './ids';

export type TCharacter<Ch extends TCharacterId> = {
    id: Ch;
    name: string;
    description?: string;
    image?: string;

    startPassageId?: TCharacterPassageId<Ch>;
    init: Omit<TWorldState['characters'][Ch], 'inventory' | 'ref'> & TInitInventory;
};

export type TCharacterData = {
    location?: TLocationId;
    health: number;
    inventory: TItem<TItemId>[];
};
