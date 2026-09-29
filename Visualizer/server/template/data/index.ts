/**
 * `@story/data` — the story itself: chapters, passages, characters, locations, items, and the
 * art that goes with them. `@story/types` derives its id unions from this folder
 * (`TWorldState`, `register`, `itemInfo`), type-only, so the two folders form one surface.
 *
 * This barrel carries the handful of symbols the engine itself consumes. Deep imports into the
 * author's tree (`@story/data/chapters/start/start.chapter.ts`) are legal too.
 */

/* register, TRegisterPassageId — every chapter, character and location of the story, plus the
   lazy `passages` map whose dynamic imports code-split the story per chapter */
export * from './register';
/* TWorldState — the shape of this story's world state (type-only) */
export type * from './TWorldState';
/* itemInfo, TItemType — the static per-item data the inventory merges in */
export * from './items/itemInfo';
