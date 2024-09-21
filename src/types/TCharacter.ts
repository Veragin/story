import { register } from 'data/register';
import { TWorldState } from 'data/TWorldState';
import { TLocationId } from './TLocation';
import { TItem, TItemId } from './TItem';

export type TCharacterId = keyof (typeof register)['characters'];
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

export type TSideCharacterId = keyof (typeof register)['sideCharacters'];
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

export type TEventId = keyof (typeof register)['events'];

export type TCharacterIdInEvent<E extends TEventId> =
    keyof (typeof register)['events'][E]['passages'];
export type TPassageId<
    E extends TEventId,
    Ch extends TCharacterIdInEvent<E>
> = keyof (typeof register)['events'][E]['passages'][Ch];

export type TStartPassageId<E extends TEventId, Ch> = TPassageId<
    E,
    Extract<Ch, TCharacterIdInEvent<E>>
>;
