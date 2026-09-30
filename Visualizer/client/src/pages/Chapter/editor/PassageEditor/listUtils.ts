export const replaceAt = <T>(list: T[], i: number, value: T) => list.map((x, j) => (j === i ? value : x));

export const without = <T extends object>(obj: T, key: keyof T): T => {
    const next = { ...obj };
    delete next[key];
    return next;
};

/** Sets an optional field; `undefined` removes the key so it is not written as `key: undefined`. */
export const setField = <T extends object, K extends keyof T>(obj: T, key: K, value: T[K] | undefined): T =>
    value === undefined ? without(obj, key) : { ...obj, [key]: value };
