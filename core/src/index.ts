/**
 * `@story/core` — the headless story runtime.
 *
 * Layering (REFACTOR_PLAN §2, as amended): shared → types → { ui, core } → data → services.
 * Headless: no rendering library, no component toolkit, no dependency on the UI package —
 * the same runtime has to work inside the future MultiEngine node server. `mobx` is fine;
 * it is a state-observability library, not a renderer.
 *
 * Deviations from §3's `core/` table, all deliberate and all decided by the author:
 *  - `TWorldState` does **not** move here. It is `data/TWorldState.ts` and it stays in the
 *    author's tree; it pulls eight modules out of `data/` (locations, chapters, characters,
 *    sideCharacters), so hosting it here would create a value-shaped core → data edge.
 *    Core imports it **type-only**; `types ⇄ data` is an accepted, documented type-only cycle
 *    confined to the author's two folders (§2.1). As of Phase 6 the specifier is `@story/data`.
 *    Note the remaining honest wart: `History`/`Processor`/`Inventory`/`Story` import
 *    `register` / `itemInfo` from `@story/data` at **value** level, so `core → data` is a real
 *    runtime edge today (declared in `core/package.json`). Injecting the register the way
 *    `createWorldState` already does is the fix; it belongs with the SingleEngine work.
 *  - `parsePassageId` lands here rather than in `shared/` (§3). It imports `@story/types`, and
 *    `shared` may not — it would be `shared`'s only edge back to `types` under the confirmed
 *    layering. Its only consumers are the engine modules in this package.
 *  - `createWorldState` keeps the register shape it was given in Phase 1 and gains a sibling,
 *    `buildWorldState`, so the Visualizer can get a pristine state without an `Engine`.
 */

/* Engine — the runtime root; owns inventory/history/processor/story/store and localStorage save-load */
export * from './engine/Engine';
/* Story — goToPassage, spendTime */
export * from './engine/Story';
/* Processor — turn loop, chapter triggers, cost parsing */
export * from './engine/Processor';
/* History, THistoryItem, THistoryTurnItem */
export * from './engine/History';
/* Inventory */
export * from './engine/Inventory';
/* Store — the observable "currently displayed passage" holder */
export * from './engine/Store';
/* DUMMY_PASSAGE, TUnkownPassageScreen */
export * from './engine/const';

/* buildWorldState, TWorldStateRegister, TItemInfoRegister */
export * from './worldState/buildWorldState';
/* createWorldState */
export * from './worldState/createWorldState';
/* loadWorldState, copyWorldState */
export * from './worldState/loadWorldState';

/* parsePassageId */
export * from './parsePassageId';
