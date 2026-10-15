import { useCallback, useState } from 'react';
import { STORY_ID } from './api/story';

// Every access is try/catch: storage can be missing, full, blocked or hold garbage
export const UI_STATE_PREFIX = `visualizer:${STORY_ID}:`;

const getStorage = (): Storage | null => {
    try {
        return typeof window === 'undefined' ? null : window.sessionStorage;
    } catch {
        return null;
    }
};

export const getUiState = <T>(key: string, fallback: T): T => {
    try {
        const raw = getStorage()?.getItem(UI_STATE_PREFIX + key);
        if (raw === null || raw === undefined) return fallback;
        return JSON.parse(raw) as T;
    } catch {
        return fallback;
    }
};

export const setUiState = <T>(key: string, value: T): void => {
    try {
        const storage = getStorage();
        if (!storage) return;
        if (value === undefined) {
            storage.removeItem(UI_STATE_PREFIX + key);
        } else {
            storage.setItem(UI_STATE_PREFIX + key, JSON.stringify(value));
        }
    } catch {
        // storage unavailable or full: view state is best effort
    }
};

export const removeUiState = (key: string): void => {
    try {
        getStorage()?.removeItem(UI_STATE_PREFIX + key);
    } catch {
        // best effort, like setUiState
    }
};

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
