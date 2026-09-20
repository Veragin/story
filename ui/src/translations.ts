/**
 * Translation helper — re-exported from `@story/shared`.
 *
 * `applyFormatting` is a pure string function with no React in it, and `data/` (which may not
 * depend on `ui`) is one of its consumers, so the implementation lives in `@story/shared`
 * (`shared/src/translations.ts`) — the same move `showToast` got in Phase 5. This module keeps
 * `@story/ui`'s public surface unchanged for the front-ends that already import it from here.
 *
 * Importing this module still installs the global `_`: the re-export evaluates
 * `shared/src/translations.ts`, whose module body assigns `globalThis._`.
 */

export { applyFormatting } from '@story/shared';
