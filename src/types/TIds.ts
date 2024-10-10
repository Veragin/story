import { TWorldState } from 'data/TWorldState';

export type TCharacterId = keyof TWorldState['characters'];
export type TSideCharacterId = keyof TWorldState['sideCharacters'];

export type TEventId = keyof TWorldState['events'];

export type TPassageId = `${TEventId}-${TCharacterId}-${string}`;
export type TEventPassageId<E extends TEventId> = `${E}-${TCharacterId}-${string}`;
export type TCharacterPassageId<Ch extends TCharacterId> = `${TEventId}-${Ch}-${string}`;
export type TEventCharacterPassageId<E extends TEventId, Ch extends TCharacterId> = `${E}-${Ch}-${string}`;
