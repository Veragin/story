/**
 * Framework-agnostic toast port.
 *
 * The *rendering* of a toast is a UI concern and lives in `@story/ui` (notistack inside
 * `GlobalThemeWrapper`). The *act of asking for one* is not: the headless story runtime in
 * `@story/core` reports "Game was saved" / "You have spent: …", and `@story/core` may not
 * import `@story/ui` (REFACTOR_PLAN §2 — core is headless, no React).
 *
 * So the callable sits here, in the one package everything may depend on, and the UI layer
 * registers the real implementation at mount time via `setToastHandler`. Until it does,
 * `showToast` is a no-op — which is also exactly the right behaviour for a headless host
 * (tests, the future MultiEngine node server).
 *
 * `@story/ui` re-exports both names, so UI code can keep importing them from there.
 */

export type TToastVariant = 'default' | 'error' | 'success' | 'warning' | 'info';

export type TToastOptions = {
    variant?: TToastVariant;
};

/** Deliberately narrower than notistack's `EnqueueSnackbar`: plain string + variant, nothing React-shaped. */
export type TToastHandler = (message: string, options?: TToastOptions) => void;

let handler: TToastHandler = () => {};

/** Called by `@story/ui`'s `GlobalThemeWrapper` once notistack's provider has mounted. */
export const setToastHandler = (newHandler: TToastHandler) => {
    handler = newHandler;
};

export const showToast: TToastHandler = (message, options) => handler(message, options);
