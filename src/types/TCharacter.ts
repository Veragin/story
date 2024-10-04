import { TWorldState } from 'data/TWorldState';
import { TLocationId } from './TLocation';
import { TItem, TItemId } from './TItem';
import { TCharacterId, TCharacterPassageId, TSideCharacterId } from './TIds';

export type TCharacter<Ch extends TCharacterId> = {
    id: Ch;
    name: string;

    startPassageId: TCharacterPassageId<Ch>;
    init: Omit<TWorldState['characters'][Ch], 'inventory' | 'ref'> & TInitInventory;
};

export type TCharacterData = {
    location: TLocationId | undefined;
    health: number;
    stamina: number;
    hunger: number;
    inventory: TItem<TItemId>[];
};

export type TSideCharacter<Ch extends TSideCharacterId> = {
    id: Ch;
    name: string;
    description: string;
    race?: TRace;

    init: Omit<TWorldState['sideCharacters'][Ch], 'inventory' | 'ref'> & TInitInventory;
};
export type TSideCharacterData = {
    location: TLocationId | undefined;
    inventory: TItem<TItemId>[];
    isDead: boolean;
};

export type TRace = {
    name: string;
    description: string;
}

