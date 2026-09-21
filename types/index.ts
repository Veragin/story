/**
 * `@story/types` — the author's type surface (REFACTOR_PLAN §2.1: flat, no `src/`).
 *
 * Depends on `@story/shared` only (for `Time` / `DeltaTime` / `TimeRange`).
 */

/* TPoint, TSize, TVec */
export * from './geometry';

/* TCharacterId, TSideCharacterId, TChapterId,
   TPassageId, TChapterPassageId, TCharacterPassageId, TChapterCharacterPassageId */
export * from './ids';

/* TChapter */
export * from './TChapter';
/* TCharacter, TCharacterData, TSideCharacter, TSideCharacterData */
export * from './TCharacter';
/* TItemId, TItem, TItemPartial */
export * from './TItem';
/* TLocation, TLocationId */
export * from './TLocation';
/* TChapterPassage, TPassage, TPassageScreen, TPassageTransition, TPassageLinear,
   TLink, TLinkCost, TChapterPassageType, getWholePassageId */
export * from './TPassage';
/* TTimeTrigger */
export * from './TTimeTrigger';
