/**
 * A debug hook of the SingleEngine app alone (REFACTOR_PLAN §3).
 *
 * `./worldState.ts` parks this app's world-state instance and its engine on `window` so a
 * developer can drive a running story from the browser console. No module reads them back and
 * no other app declares them — which is why the augmentation lives in the app rather than in
 * `@story/types`.
 *
 * This file is the last survivor of the old `src/@types/global.d.ts` parking spot: `TPoint` /
 * `TSize` / `TVec` became real exports of `@story/types` in Phase 3, `Time` / `DeltaTime`
 * exports of `@story/shared` in the same phase, and `declare let _` moved next to the module
 * that installs it (`shared/src/translations.{ts,d.ts}`) in Phase 4.
 */

declare interface Window {
    e: import('@story/core').Engine;
    s: import('@story/data').TWorldState;
}
