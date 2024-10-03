import { TWorldState } from 'data/TWorldState';
import { TLocationId } from './TLocation';
import { TItem, TItemId } from './TItem';
import { TCharacterId, TCharacterPassageId, TSideCharacterId } from './TIds';

export type TCharacter<Ch extends TCharacterId> = {
    id: Ch;
    name: string;

    startPassageId: TCharacterPassageId<Ch> | undefined;
    init: TCharacterData & Partial<TWorldState['characters'][Ch]>;
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

    init: TSideCharacterData & Partial<TWorldState['sideCharacters'][Ch]>;
};

export type TSideCharacterData = {
    location: TLocationId | undefined;
    inventory: TItem<TItemId>[];
};

export type TRace = {
    name: string;
    description: string;
}

