/**
 * Imperative toast entry point — re-exported from `@story/shared`.
 *
 * notistack only exposes `enqueueSnackbar` through the `useSnackbar` hook, so a component
 * inside `SnackbarProvider` has to hand it over. `GlobalThemeWrapper` renders a tiny
 * `ToastWrapper` that calls `setToastHandler` on every render; everything else — including
 * non-React modules such as the Visualizer's `Agent` store — calls `showToast`.
 *
 * The callable itself lives in `@story/shared` (`shared/src/toast.ts`) rather than here,
 * because `@story/core`'s `Engine`/`Story` also raise toasts and core may not import `ui`
 * (REFACTOR_PLAN §2 — core is headless). This module keeps `@story/ui`'s public surface
 * unchanged for the front-ends that already import `showToast` from it.
 */

export { showToast, setToastHandler } from '@story/shared';
export type { TToastHandler, TToastOptions, TToastVariant } from '@story/shared';
