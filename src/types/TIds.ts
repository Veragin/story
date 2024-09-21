import { register } from 'data/register';

export type TCharacterId = keyof (typeof register)['characters'];
export type TSideCharacterId = keyof (typeof register)['sideCharacters'];

export type TEventId = keyof (typeof register)['events'];
export type TPassageId<
    E extends TEventId,
    Ch extends TCharacterIdInEvent<E>
> = keyof (typeof register)['events'][E]['passages'][Ch];

export type TCharacterIdInEvent<E extends TEventId> =
    keyof (typeof register)['events'][E]['passages'];

export type TStartPassageId<E extends TEventId, Ch> = TPassageId<
    E,
    Extract<Ch, TCharacterIdInEvent<E>>
>;
