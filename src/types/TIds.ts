import { TWorldState } from 'data/TWorldState';

export type TCharacterId = keyof TWorldState['characters'];
export type TSideCharacterId = keyof TWorldState['sideCharacters'];

export type TChapterId = keyof TWorldState['chapters'];
export type THappeningId = keyof TWorldState['happenings'];

export type TPassageId = `${string}-${string}-${string}`;
export type TChapterPassageId<E extends TChapterId> = `${E}-${TCharacterId}-${string}`;
export type TCharacterPassageId<Ch extends TCharacterId> = `${TChapterId}-${Ch}-${string}`;
export type TChapterCharacterPassageId<E extends TChapterId, Ch extends TCharacterId> = `${E}-${Ch}-${string}`;