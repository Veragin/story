/**
 * `@story/types` — the author's type surface (REFACTOR_PLAN §2.1: flat, no `src/`).
 *
 * Depends on `@story/shared` only (for `Time` / `DeltaTime` / `TimeRange` / `TPassageIdFor`).
 *
 * Engine types the author never edits are NOT here — they are exports of `@story/shared`:
 * `TPoint` / `TSize` / `TVec` (geometry) and `TPassageId` / `TPassageIdFor` (the id format).
 */

/* TCharacterId, TSideCharacterId, TChapterId,
   TChapterPassageId, TCharacterPassageId, TChapterCharacterPassageId */
export * from './ids';

/* TChapter */
export * from './TChapter';
/* TCharacter, TCharacterData, TSideCharacter, TSideCharacterData */
export * from './TCharacter';
/* TItemId, TItem, TItemPartial */
export * from './TItem';
/* TLocation, TLocationId */
export * from './TLocation';
/* TMap, TMapId */
export * from './TMap';
/* TChapterPassage, TPassage, TPassageScreen, TPassageTransition, TPassageLinear,
   TLink, TLinkCost, TChapterPassageType, getWholePassageId */
export * from './TPassage';
/* TTimeTrigger */
export * from './TTimeTrigger';
