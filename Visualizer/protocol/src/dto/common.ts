/**
 * The verbatim source text of an initializer that is not a plain literal. A literal object whose
 * only key is a string `code` must be read as `{ code: '{ code: "…" }' }` so it round-trips.
 */
export type TCode = { code: string };

export type TMaybeCode<T> = T | TCode;

export const isCode = (value: unknown): value is TCode =>
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length === 1 &&
    'code' in value &&
    typeof value.code === 'string';

export const code = (source: string): TCode => ({ code: source });

/**
 * A function- or expression-valued field. `description` is its `/** … *\/` JSDoc text without the
 * markers. An empty `code` with a description is a stub: the writer emits a default (`() => {}`, or
 * `true` for a condition). Without a description it is a `TCode`.
 */
export type TFunctionDto = { code: string; description?: string };

/** A JSON-like value read from an object literal; anything else is a `TCode`. */
export type TValue = string | number | boolean | null | TCode | TValue[] | { [key: string]: TValue };

export type TValueRecord = { [key: string]: TValue };

export const isValueRecord = (value: unknown): value is TValueRecord =>
    typeof value === 'object' && value !== null && !Array.isArray(value) && !isCode(value);

/**
 * Content hash of the file(s) backing a resource; compare for equality only. `''` means "no file
 * yet": a PUT carrying it succeeds only if the file does not exist.
 */
export type TVersion = string;
export const EMPTY_VERSION: TVersion = '';

export type TVersioned = { version: TVersion };

/** 409 `stale` when `version` is not the one on disk. */
export type TVersionedBody = { version: TVersion };

export type TSourceRef = {
    /** Relative to the story folder, `/`-separated. */
    file: string;
    /** 1-based. */
    line?: number;
    exportName?: string;
};

/** The argument of `Time.fromString(…)`, e.g. `'2.1. 8:00'`. */
export type TTimeString = string;

/**
 * Read from both `{ start: Time.fromString(…), end: … }` and `TimeRange.fromString(a, b)`; writers
 * keep the file's form.
 */
export type TTimeRangeDto = {
    start: TMaybeCode<TTimeString>;
    end: TMaybeCode<TTimeString>;
};

/** A `DeltaTime` with a literal argument; anything else is a `TCode`. */
export type TDeltaTimeDto = { seconds: number };

export const isDeltaTime = (value: unknown): value is TDeltaTimeDto =>
    typeof value === 'object' &&
    value !== null &&
    'seconds' in value &&
    typeof value.seconds === 'number' &&
    Object.keys(value).length === 1;

export type TOkDto = { ok: true };
