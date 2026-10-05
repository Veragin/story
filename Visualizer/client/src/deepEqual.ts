export const deepEqual = (a: unknown, b: unknown): boolean => {
    if (a === b) return true;
    if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
    if (Array.isArray(a) || Array.isArray(b)) {
        return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => deepEqual(x, b[i]));
    }
    const ao = new Map(Object.entries(a));
    const bo = new Map(Object.entries(b));
    return [...new Set([...ao.keys(), ...bo.keys()])].every((k) => deepEqual(ao.get(k), bo.get(k)));
};
