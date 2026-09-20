/**
 * Ambient declaration for the global translation helper installed at runtime by
 * `./translations.ts` (`globalThis._ = ...`). It sits next to the module that installs it
 * rather than in an app-level `global.d.ts` (REFACTOR_PLAN §3).
 *
 * It lives in `shared` rather than `ui` (where §3 parked it) because `data/` calls `_(...)`
 * and `applyFormatting`, and `data` may not depend on `ui` — see `./translations.ts`.
 *
 * The global only exists once `./translations.ts` has been evaluated — `GlobalThemeWrapper`
 * is what guarantees that for both front-ends.
 */

declare let _: (str: string, ...values: (string | number)[]) => string;
