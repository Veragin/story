import { vi } from 'vitest';

// `Engine` uses the global `localStorage`, which node lacks
export type TLocalStorageStub = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'clear'> & {
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

export const installLocalStorageStub = (): TLocalStorageStub => {
    const stub = createLocalStorageStub();
    vi.stubGlobal('localStorage', stub);
    return stub;
};
