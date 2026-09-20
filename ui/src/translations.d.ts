/**
 * Ambient declaration for the global translation helper installed at runtime by
 * `./translations.ts` (`globalThis._ = ...`). It sits next to the module that installs it
 * rather than in an app-level `global.d.ts` (REFACTOR_PLAN §3).
 *
 * The global only exists once `./translations.ts` has been evaluated — `GlobalThemeWrapper`
 * is what guarantees that for both front-ends.
 */

declare let _: (str: string, ...values: (string | number)[]) => string;
