import type { EnqueueSnackbar } from 'notistack';

/**
 * Imperative toast entry point.
 *
 * notistack only exposes `enqueueSnackbar` through the `useSnackbar` hook, so a component
 * inside `SnackbarProvider` has to hand it over. `GlobalThemeWrapper` renders a tiny
 * `ToastWrapper` that calls `setToastHandler` on every render; everything else — including
 * non-React modules such as the Visualizer's `Agent` store — calls `showToast`.
 *
 * Keeping the callable here (rather than in `GlobalThemeWrapper.tsx`) is what stops plain
 * `.ts` modules from importing a component module (REFACTOR_PLAN §3).
 */

/** No-op until the provider mounts; returns notistack's `SnackbarKey` shape. */
let enqueue: EnqueueSnackbar = () => '0';

/** Called by `GlobalThemeWrapper`'s `ToastWrapper`. Not part of the public surface. */
export const setToastHandler = (handler: EnqueueSnackbar) => {
    enqueue = handler;
};

export const showToast = (...data: Parameters<EnqueueSnackbar>) => enqueue(...data);
