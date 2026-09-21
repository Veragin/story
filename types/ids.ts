import type { TWorldState } from '@story/data';
import type { TPassageIdFor } from '@story/shared';

export type TCharacterId = keyof TWorldState['characters'];
export type TSideCharacterId = keyof TWorldState['sideCharacters'];

export type TChapterId = keyof TWorldState['chapters'];

/**
 * The passage-id format itself is engine machinery and lives in `@story/shared`
 * (`TPassageId`, `TPassageIdFor`). These three bind it to the story's own id unions, which is
 * the part that has to stay here: they are `keyof` the author's world state, and `shared` may
 * not import `@story/data`.
 */
export type TChapterPassageId<E extends TChapterId> = TPassageIdFor<E, TCharacterId>;
export type TCharacterPassageId<Ch extends TCharacterId> = TPassageIdFor<TChapterId, Ch>;
export type TChapterCharacterPassageId<E extends TChapterId, Ch extends TCharacterId> = TPassageIdFor<E, Ch>;
