import { TWorldState } from 'data/TWorldState';
import { TLocationId } from './TLocation';
import { TItem, TItemId } from './TItem';
import { TCharacterId, TEventId, TSideCharacterId, TStartPassageId } from './TIds';

export type TCharacter<Ch extends TCharacterId> = {
    id: Ch;
    name: string;

    startPassageId?: TStartPassageId<TEventId, Ch>;
    init: TCharacterData & Partial<TWorldState['characters'][Ch]>;
};
export type TCharacterData = {
    location: TLocationId;
    health: number;
    stamina: number;
    hunger: number;
    inventory: TItem<TItemId>[];
};

export type TSideCharacter<Ch extends TSideCharacterId> = {
    id: Ch;
    name: string;
    description: string;

    init: TSideCharacterData & Partial<TWorldState['sideCharacters'][Ch]>;
};
export type TSideCharacterData = {
    location: TLocationId;
    inventory: TItem<TItemId>[];
};
