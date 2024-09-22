import { TWorldState } from 'data/TWorldState';
import { TLocationId } from './TLocation';
import { TItem, TItemId } from './TItem';
import { TCharacterId, TCharacterIdInEvent, TEventId, TPassageId, TSideCharacterId } from './TIds';

export type TCharacter<Ch extends TCharacterId> = {
    id: Ch;
    name: string;

    startPassagePt: TPassagePt<TEventId, Ch>;
    init: TCharacterData & Partial<TWorldState['characters'][Ch]>;
};

export type TPassagePt<E extends TEventId, Ch extends TCharacterId> = {
    eventId: E;
    characterId: Ch;
    passageId: TPassageId<E, Extract<Ch, TCharacterIdInEvent<E>>>;
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
