/**
 * Tiny shape checks for the JSON stores. They throw `ShapeError` naming the offending path
 * (`data[3][7].tile`); the store turns it into a 400 for a request body or a 422 for a broken
 * file on disk.
 */
export class ShapeError extends Error {
    constructor(
        readonly at: string,
        readonly expected: string
    ) {
        super(`${at || 'value'}: expected ${expected}`);
        this.name = 'ShapeError';
    }
}

export const isRecord = (v: unknown): v is Record<string, unknown> =>
    typeof v === 'object' && v !== null && !Array.isArray(v);

export const expectRecord = (v: unknown, at: string): Record<string, unknown> => {
    if (!isRecord(v)) throw new ShapeError(at, 'an object');
    return v;
};

export const expectArray = (v: unknown, at: string): unknown[] => {
    if (!Array.isArray(v)) throw new ShapeError(at, 'an array');
    return v;
};

export const expectString = (v: unknown, at: string): string => {
    if (typeof v !== 'string') throw new ShapeError(at, 'a string');
    return v;
};

export const optionalString = (v: unknown, at: string): string | undefined =>
    v === undefined ? undefined : expectString(v, at);

export const expectNumber = (v: unknown, at: string): number => {
    if (typeof v !== 'number' || !Number.isFinite(v)) throw new ShapeError(at, 'a finite number');
    return v;
};

export const expectInteger = (v: unknown, at: string, min = 0): number => {
    if (typeof v !== 'number' || !Number.isInteger(v) || v < min) {
        throw new ShapeError(at, `an integer >= ${min}`);
    }
    return v;
};

export const expectPoint = (v: unknown, at: string): { x: number; y: number } => {
    const o = expectRecord(v, at);
    onlyKeys(o, at, ['x', 'y']);
    return { x: expectNumber(o.x, `${at}.x`), y: expectNumber(o.y, `${at}.y`) };
};

/** Refuse keys the format does not know, so a typo is an error instead of silently lost data. */
export const onlyKeys = (o: Record<string, unknown>, at: string, allowed: readonly string[]) => {
    for (const key of Object.keys(o)) {
        if (!allowed.includes(key)) {
            throw new ShapeError(at ? `${at}.${key}` : key, `no such field (allowed: ${allowed.join(', ')})`);
        }
    }
};
