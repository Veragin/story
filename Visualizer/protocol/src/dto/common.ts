/**
 * Building blocks shared by every DTO.
 *
 * ## Code fields (plan §3 "Code-field convention")
 *
 * A field whose source initializer may be an arbitrary expression is typed `X | TCode`.
 * Readers return the plain literal when the initializer is one (`'Forest'`, `true`, `10`), and
 * `{ code }` — the initializer's source text, verbatim — whenever it is not (`_('visit')`,
 * `s.characters.annie.health > 0`, `() => {}`). Writers put `code` back with `setInitializer`.
 *
 * Known ambiguity: inside a free-form value (`TValue`, used for `init` objects) a literal object
 * whose only key is a string `code` is indistinguishable from a `TCode`. Readers must return such
 * an object as `{ code: '{ code: "…" }' }` so that it round-trips.
 */

export type TCode = { code: string };

/** A value that is either the literal `T` or a code snippet. */
export type TMaybeCode<T> = T | TCode;

export const isCode = (value: unknown): value is TCode =>
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length === 1 &&
    typeof (value as { code?: unknown }).code === 'string';

export const code = (source: string): TCode => ({ code: source });

/**
 * A free-form, JSON-like value read out of an object literal (`init`, item properties).
 * Anything that is not a plain literal / array / object literal is a `TCode`.
 */
export type TValue = string | number | boolean | null | TCode | TValue[] | { [key: string]: TValue };

/** A record of free-form values — the shape of every `init` object. */
export type TValueRecord = { [key: string]: TValue };

/**
 * Content-hash version of the file(s) backing a resource (plan §3 "Live refresh", point 3).
 * Opaque to the client: compare for equality only. `''` (`EMPTY_VERSION`) means "no file yet":
 * a PUT carrying `''` succeeds only if the backing file does not exist (create-if-missing for
 * `map.json` and the `*.layout.json` files).
 */
export type TVersion = string;
export const EMPTY_VERSION: TVersion = '';

/** Every resource DTO carries the version it was read at. */
export type TVersioned = { version: TVersion };

/** Every PUT / DELETE body carries the version it was based on (409 `stale` on mismatch). */
export type TVersionedBody = { version: TVersion };

/**
 * Where a resource lives on disk, relative to its story's folder (`stories/<id>/`), with `/`
 * separators — e.g. `data/chapters/village/thomas.passages/intro.ts`. Shown in the forms and
 * with diagnostics.
 */
export type TSourceRef = {
    file: string;
    /** 1-based line of the resource's declaration, when known. */
    line?: number;
    /** Exported binding that holds the resource (`introPassage`, `villageChapter`, `Thomas`). */
    exportName?: string;
};

/**
 * A point in time as the source writes it: the argument of `Time.fromString(…)` from
 * `@story/shared`, e.g. `'2.1. 8:00'` or `'1.12 0:0'`. Use `Time.fromString` on the client to
 * get seconds. Initializers that are not `Time.fromString('<literal>')` come back as `TCode`.
 */
export type TTimeString = string;

/**
 * A time range. Both source forms read to this one shape:
 *  - `{ start: Time.fromString('2.1. 8:00'), end: Time.fromString('5.1. 8:00') }`
 *  - `TimeRange.fromString('5.1. 9:00', '6.1. 8:00')`
 * Writers keep whichever form the file already uses.
 */
export type TTimeRangeDto = {
    start: TMaybeCode<TTimeString>;
    end: TMaybeCode<TTimeString>;
};

/**
 * A duration (`DeltaTime`) in seconds. Readers accept `DeltaTime.fromMin(n)`,
 * `DeltaTime.fromHour(n)`, `DeltaTime.fromS(n)` and `DeltaTime.fromString('<literal>')` with
 * literal arguments; anything else (`s.time.s < 10 ? … : …`) is a `TCode`. Writers emit the
 * simplest form (`fromMin` when divisible by 60, else `fromS`) unless the value is unchanged.
 */
export type TDeltaTimeDto = { seconds: number };

export const isDeltaTime = (value: unknown): value is TDeltaTimeDto =>
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { seconds?: unknown }).seconds === 'number' &&
    Object.keys(value).length === 1;

/** `{ ok: true }` — the reply of actions that return no resource (delete). */
export type TOkDto = { ok: true };
