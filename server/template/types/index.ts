/**
 * `@story/types` — the author's type surface (REFACTOR_PLAN §2.1: flat, no `src/`).
 *
 * Depends on `@story/shared` only (for `Time` / `DeltaTime` / `TimeRange` / `TPassageIdFor`).
 *
 * Engine types the author never edits are NOT here — they are exports of `@story/shared`:
 * `TPoint` / `TSize` / `TVec` (geometry) and `TPassageId` / `TPassageIdFor` (the id format).
 */

/* TCharacterId, TNpcId, TChapterId,
   TChapterPassageId, TCharacterPassageId, TChapterCharacterPassageId */
export * from './ids';
/* literals shared across files */
export * from './literals';

/* TChapter */
export * from './TChapter';
/* TCharacter, TCharacterData */
export * from './TCharacter';
/* TNpc, TNpcData */
export * from './TNpc';
/* TItemId, TItem, TItemPartial, TInitInventory */
export * from './TItem';
/* TLocation, TLocationId */
export * from './TLocation';
/* TChapterPassage, TPassage, TPassageScreen, TPassageTransition, TPassageLinear,
   TLink, TLinkCost, TChapterPassageType, getWholePassageId */
export * from './TPassage';
/* TTimeTrigger */
export * from './TTimeTrigger';
