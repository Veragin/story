/**
 * `@story/data` — the story itself: chapters, passages, characters, locations, items,
 * happenings, and the art that goes with them (REFACTOR_PLAN §2.1: flat, no `src/`, consumed
 * as TypeScript source so an edit hot-reloads straight into the running app).
 *
 * Layering (REFACTOR_PLAN §2, as amended): shared → types → { ui, core } → data → services.
 *
 * Two documented deviations, both confined to the author's two folders:
 *
 *  1. **`TWorldState` lives here, not in `core`** (§3 says `core/`). It is the shape of *this*
 *     story's state and it is assembled from eight sibling modules under `data/` — moving it to
 *     `core` would turn a type-only edge into a value-shaped `core → data` one. `core` imports
 *     it `import type`, so nothing of it survives to runtime.
 *  2. **A type-only `types ⇄ data` cycle is accepted.** `@story/types` derives its id unions
 *     from this story (`types/ids.ts`, `TChapter`, `TCharacter`, `TLocation`, `THappening` read
 *     `TWorldState`; `TItem` reads `itemInfo`; `TLocation` reads `register`), while the story is
 *     typed by `@story/types`. Every one of those imports is an `import type` and is elided at
 *     runtime, so the cycle exists only in the type graph, where it is legal and resolved by
 *     `tsc` in a single pass. Keep it that way: a value import from `types/` into `data/` would
 *     turn it into a real module cycle.
 *
 * Deep imports into this package are legal and expected — the author's tree *is* the public
 * surface, and `package.json#exports` maps `"./*"` for exactly that reason
 * (`@story/data/chapters/village/village.chapter.ts`). This barrel carries the handful of
 * symbols the engine itself consumes.
 */

/* register, TRegisterPassageId — every chapter, character, location and happening of the
   story, plus the lazy `passages` map whose dynamic imports code-split the story per chapter */
export * from './register';
/* TWorldState — the shape of this story's world state (type-only: see note 1 above) */
export type * from './TWorldState';
/* itemInfo, TItemType — the static per-item data the inventory merges in */
export * from './items/itemInfo';

/* Deliberately *not* re-exported here: `./assets`. It is reached as `@story/data/assets`
   (`assets`, `resolveAsset`) because it is built on `import.meta.glob`, which only exists
   inside a bundler — and `@story/core`, which imports this barrel, has to stay runnable
   under plain node for the future MultiEngine server (§2). */
