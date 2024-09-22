import { register } from 'data/register';
import { TWorldState } from 'data/TWorldState';

export type TCharacterId = keyof TWorldState['characters'];
export type TSideCharacterId = keyof TWorldState['sideCharacters'];

export type TEventId = keyof TWorldState['events'];
export type TPassageId = keyof (typeof register)['passages'];

export type TEventPassageId<E extends TEventId> = TPassageId & `${E}-${TCharacterId}-${string}`;
export type TCharacterPassageId<Ch extends TCharacterId> = TPassageId &
    `${TEventId}-${Ch}-${string}`;
export type TEventCharacterPassageId<E extends TEventId, Ch extends TCharacterId> = TPassageId &
    `${E}-${Ch}-${string}`;
