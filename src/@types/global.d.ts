/**
 * TEMPORARY PARKING SPOT — everything left here has a documented destination.
 *
 * - The `Window { e, s }` augmentation is a debug hook of the SingleEngine app only and
 *   moves to `SingleEngine/src/global.d.ts` in Phase 7. Its `import(...)` targets still
 *   resolve through the legacy `code/*` and `data/*` tsconfig paths.
 *
 * Gone as of Phase 3: `TPoint` / `TSize` / `TVec` are real exported types in `@story/types`
 * (`types/geometry.ts`), and `Time` / `DeltaTime` (previously `src/@types/time.d.ts`) are
 * real exports of `@story/shared`. No ambient globals for either.
 *
 * Gone as of Phase 4: `declare let _` now lives in `ui/src/translations.d.ts`, next to the
 * `ui/src/translations.ts` module that installs it on `globalThis`.
 */

declare interface Window {
    e: import('code/Engine/ts/Engine').Engine;
    s: import('data/TWorldState').TWorldState;
}
