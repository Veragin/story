import { useCallback, useState } from 'react';

/**
 * View state that should survive a page reload (camera, selection, open panel, unsaved input…).
 *
 * Backed by `sessionStorage`, so it is per browser tab and is gone when the tab closes. Every
 * access is wrapped in try/catch: storage can be missing, full, blocked or hold garbage, and the
 * app must keep working without it (plan §3 "Live refresh", point 4).
 */

const PREFIX = 'visualizer:';

const getStorage = (): Storage | null => {
    try {
        return typeof window === 'undefined' ? null : window.sessionStorage;
    } catch {
        return null;
    }
};

/** Read `key`. Returns `fallback` when it is missing, unreadable or not valid JSON. */
export const getUiState = <T>(key: string, fallback: T): T => {
    try {
        const raw = getStorage()?.getItem(PREFIX + key);
        if (raw === null || raw === undefined) return fallback;
        return JSON.parse(raw) as T;
    } catch {
        return fallback;
    }
};

/** Write `key`. `undefined` removes it. Failures are ignored. */
export const setUiState = <T>(key: string, value: T): void => {
    try {
        const storage = getStorage();
        if (!storage) return;
        if (value === undefined) {
            storage.removeItem(PREFIX + key);
        } else {
            storage.setItem(PREFIX + key, JSON.stringify(value));
        }
    } catch {
        // storage unavailable or full: view state is best effort
    }
};

export const removeUiState = (key: string): void => {
    try {
        getStorage()?.removeItem(PREFIX + key);
    } catch {
        // ignore
    }
};

/**
 * `useState` that also mirrors its value into `sessionStorage` under `key`.
 * The initial value comes from storage when present.
 */
export const useUiState = <T>(key: string, initial: T): [T, (value: T | ((prev: T) => T)) => void] => {
    const [value, setValue] = useState<T>(() => getUiState(key, initial));

    const set = useCallback(
        (next: T | ((prev: T) => T)) => {
            setValue((prev) => {
                const resolved = typeof next === 'function' ? (next as (prev: T) => T)(prev) : next;
                setUiState(key, resolved);
                return resolved;
            });
        },
        [key]
    );

    return [value, set];
};
