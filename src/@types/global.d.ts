/**
 * TEMPORARY PARKING SPOT — everything left here has a documented destination.
 *
 * - The `Window { e, s }` augmentation is a debug hook of the SingleEngine app only and
 *   moves to `SingleEngine/src/global.d.ts` in Phase 7. Both of its `import(...)` targets are
 *   package specifiers now; nothing here depends on a legacy tsconfig path any more.
 *
 * Gone as of Phase 3: `TPoint` / `TSize` / `TVec` are real exported types in `@story/types`
 * (`types/geometry.ts`), and `Time` / `DeltaTime` (previously `src/@types/time.d.ts`) are
 * real exports of `@story/shared`. No ambient globals for either.
 *
 * Gone as of Phase 4: `declare let _` is no longer an app-level global — it lives next to the
 * module that installs it on `globalThis`, `shared/src/translations.{ts,d.ts}` (moved there
 * from `ui/` in Phase 6 so that `data/` can use `applyFormatting` without depending on `ui`;
 * `@story/ui` still re-exports it).
 */

declare interface Window {
    e: import('@story/core').Engine;
    s: import('@story/data').TWorldState;
}
