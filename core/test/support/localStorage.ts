import { vi } from 'vitest';

/**
 * An in-memory stand-in for the browser's `localStorage`.
 *
 * `Engine`'s constructor calls `loadStateFromLocalStorage`, and `saveStateToLocalStorage` /
 * `clearStateFromLocalStorage` reach for the global directly — so `@story/core`, which
 * REFACTOR_PLAN §2 calls "headless, usable from the future MultiEngine node server", cannot
 * actually be constructed under plain node: the bare identifier throws
 * `ReferenceError: localStorage is not defined`. `@types/node` declares `localStorage`, which
 * is why `tsc` never flags it.
 *
 * The proper fix is a save-store port injected into `Engine` (same shape as `setToastHandler`
 * in `@story/shared`), which is out of scope for the Vitest phase. Until then the runtime is
 * pinned by `engine.saveLoad.test.ts` and unblocked here. This is deliberately *not* a reason
 * to run the `core` project under `environment: 'jsdom'`: a DOM is not what the engine is
 * missing, one browser storage API is, and pretending otherwise would hide the coupling.
 */
export type TLocalStorageStub = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'clear'> & {
    /** The backing map, so a test can inspect or seed what the engine persisted. */
    entries: Map<string, string>;
};

export const createLocalStorageStub = (): TLocalStorageStub => {
    const entries = new Map<string, string>();
    return {
        entries,
        getItem: (key: string) => entries.get(key) ?? null,
        setItem: (key: string, value: string) => void entries.set(key, String(value)),
        removeItem: (key: string) => void entries.delete(key),
        clear: () => entries.clear(),
    };
};

/** Installs a fresh stub as the global `localStorage` and hands it back for inspection. */
export const installLocalStorageStub = (): TLocalStorageStub => {
    const stub = createLocalStorageStub();
    vi.stubGlobal('localStorage', stub);
    return stub;
};
