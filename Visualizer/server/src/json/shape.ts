import { isPlainObject } from '../http/body';
import { HttpError } from '../http/HttpError';
import type { ProjectRoot } from '../project/ProjectRoot';

export class ShapeError extends Error {
    constructor(
        readonly at: string,
        readonly expected: string
    ) {
        super(`${at || 'value'}: expected ${expected}`);
        this.name = 'ShapeError';
    }
}

export const expectRecord = (v: unknown, at: string): Record<string, unknown> => {
    if (!isPlainObject(v)) throw new ShapeError(at, 'an object');
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

export const onlyKeys = (o: Record<string, unknown>, at: string, allowed: readonly string[]) => {
    for (const key of Object.keys(o)) {
        if (!allowed.includes(key)) {
            throw new ShapeError(at ? `${at}.${key}` : key, `no such field (allowed: ${allowed.join(', ')})`);
        }
    }
};

export const parseRequestBody = <T>(parse: (value: unknown) => T, value: unknown): T => {
    try {
        return parse(value);
    } catch (e) {
        if (e instanceof ShapeError) throw HttpError.badRequest(e.message);
        throw e;
    }
};

export const brokenJsonFileError = (project: ProjectRoot, file: string, e: unknown): HttpError => {
    const rel = project.rel(file);
    const message =
        e instanceof ShapeError ? e.message : `Not valid JSON: ${e instanceof Error ? e.message : String(e)}`;
    return HttpError.invalid([{ file: rel, line: 1, column: 1, message }], `${rel}: ${message}`);
};
