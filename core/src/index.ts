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
 *    npcs), so hosting it here would create a value-shaped core → data edge.
 *    Core imports it **type-only**; `types ⇄ data` is an accepted, documented type-only cycle
 *    confined to the author's two folders (§2.1). As of Phase 6 the specifier is `@story/data`.
 *  - **No value import of `@story/data` in `src/`** (`yarn lint` enforces it). The story is
 *    injected: `createWorldState(register, itemInfo, storyId)` hands the `Engine` a
 *    `TStoryModule`, exposed as `engine.storyModule`, and `History`/`Processor`/`Inventory`/
 *    `Story` read `register` / `itemInfo` from there. Nothing in `src/` names a chapter or a
 *    character either, so the same runtime plays any story whose register has that shape.
 *    `@story/data` stays in `core/package.json` for the type-only imports and for the tests,
 *    which play the example story.
 *  - `parsePassageId` lands here rather than in `shared/` (§3). It imports `@story/types`, and
 *    `shared` may not — it would be `shared`'s only edge back to `types` under the confirmed
 *    layering. Its only consumers are the engine modules in this package.
 *  - `createWorldState` takes the story (`register`, `itemInfo`) plus the story id that
 *    namespaces the save, and has a sibling, `buildWorldState`, so the Visualizer can get a
 *    pristine state without an `Engine`.
 */

/* Engine — the runtime root; owns inventory/history/processor/story/store, the injected
   storyModule, and localStorage save-load (one save per story id) */
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
/* createDummyPassage, TUnkownPassageScreen */
export * from './engine/const';

/* buildWorldState, TWorldStateRegister, TItemInfoRegister, TStoryRegister, TPassagesModule,
   TStoryModule */
export * from './worldState/buildWorldState';
/* createWorldState */
export * from './worldState/createWorldState';
/* loadWorldState, copyWorldState */
export * from './worldState/loadWorldState';

/* parsePassageId */
export * from './parsePassageId';
