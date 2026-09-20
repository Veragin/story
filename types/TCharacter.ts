import { TWorldState } from 'data/TWorldState';
import { TLocationId } from './TLocation';
import { TItem, TItemId, TItemPartial } from './TItem';
import { TCharacterId, TCharacterPassageId, TSideCharacterId } from './ids';

export type TCharacter<Ch extends TCharacterId> = {
    id: Ch;
    name: string;
    description?: string;

    startPassageId?: TCharacterPassageId<Ch>;
    init: Omit<TWorldState['characters'][Ch], 'inventory' | 'ref'> & TInitInventory;
};

export type TCharacterData = {
    location?: TLocationId;
    health: number;
    stamina: number;
    hunger: number;
    inventory: TItem<TItemId>[];
};

export type TSideCharacter<Ch extends TSideCharacterId> = {
    id: Ch;
    name: string;
    description: string;

    init: Omit<TWorldState['sideCharacters'][Ch], 'inventory' | 'ref'> & TInitInventory;
};

export type TSideCharacterData = {
    location: TLocationId | undefined;
    inventory: TItem<TItemId>[];
    isDead: boolean;
};

type TInitInventory = { inventory: TItemPartial<TItemId>[] };
