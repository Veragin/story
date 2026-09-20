/**
 * TEMPORARY PARKING SPOT — everything left here has a documented destination.
 *
 * - `_` is the translation helper installed by `src/code/utils/translations.ts`.
 *   It belongs to `@story/ui` (`ui/src/translations.d.ts`) and moves there in Phase 4.
 * - The `Window { e, s }` augmentation is a debug hook of the SingleEngine app only and
 *   moves to `SingleEngine/src/global.d.ts` in Phase 7. Its `import(...)` targets still
 *   resolve through the legacy `code/*` and `data/*` tsconfig paths.
 *
 * Gone as of Phase 3: `TPoint` / `TSize` / `TVec` are real exported types in `@story/types`
 * (`types/geometry.ts`), and `Time` / `DeltaTime` (previously `src/@types/time.d.ts`) are
 * real exports of `@story/shared`. No ambient globals for either.
 */

declare interface Window {
    e: import('code/Engine/ts/Engine').Engine;
    s: import('data/TWorldState').TWorldState;
}

declare let _: (str: string, ...values: (string | number)[]) => string;
