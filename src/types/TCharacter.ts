import { TWorldState } from 'data/TWorldState';
import { TLocationId } from './TLocation';
import { TItem, TItemId } from './TItem';
import { TCharacterId, TCharacterIdInEvent, TEventId, TPassageId, TSideCharacterId } from './TIds';

export type TCharacter<Ch extends TCharacterId> = {
    id: Ch;
    name: string;

    startPassagePt: TStartPassagePt<TEventId>;
    init: TCharacterData & Partial<TWorldState['characters'][Ch]>;
};

type TStartPassagePt<E extends TEventId> = TPassagePt<E, TCharacterIdInEvent<E>>;

export type TPassagePt<E extends TEventId, Ch extends TCharacterIdInEvent<E>> = {
    eventId: E;
    characterId: Ch;
    passageId: TPassageId<E, Ch>;
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
