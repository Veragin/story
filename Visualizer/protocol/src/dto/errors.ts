/**
 * Every non-2xx reply carries a `TApiErrorBody` (plan §3 "Server API").
 *
 * | status | `error`            | extra fields     | meaning                                              |
 * | ------ | ------------------ | ---------------- | ---------------------------------------------------- |
 * | 400    | `bad_request`      | `message`        | malformed JSON / missing or invalid fields           |
 * | 404    | `not_found`        | `message`        | no such route or resource                            |
 * | 409    | `stale`            | `current`        | the body's `version` is not the one on disk; `current` is the fresh DTO (or `null` if deleted) |
 * | 409    | `referenced`       | `references`     | delete / remove refused, other files still point here |
 * | 409    | `exists`           | `message`        | create refused, the id is taken                      |
 * | 422    | `invalid`          | `diagnostics`    | the edit does not type-check; nothing was written    |
 * | 501    | `not_implemented`  |                  | route is in the protocol, handler not written yet    |
 * | 500    | `internal`         | `message`        | bug                                                  |
 */
export type TApiErrorCode =
    | 'bad_request'
    | 'not_found'
    | 'stale'
    | 'referenced'
    | 'exists'
    | 'invalid'
    | 'not_implemented'
    | 'internal';

export type TApiErrorBody = {
    error: TApiErrorCode;
    message?: string;
    diagnostics?: TDiagnosticDto[];
    references?: TReferenceDto[];
    /** For `stale`: the current resource DTO, or `null` when it no longer exists. */
    current?: unknown;
};

/** A TypeScript diagnostic from `validate.ts`, positioned in the file that would be written. */
export type TDiagnosticDto = {
    /** Project-relative path (`data/chapters/village/thomas.passages/intro.ts`). */
    file: string;
    /** 1-based. */
    line: number;
    /** 1-based. */
    column: number;
    message: string;
    /** TS error number (`2322`). */
    code?: number;
    /** Dotted path of the DTO field the diagnostic belongs to, when the server can tell (`body.0.links.1.cost`). */
    field?: string;
};

/** A place that still refers to a resource being deleted. */
export type TReferenceDto = {
    file: string;
    line: number;
    /** The referring passage / chapter / entity, when it is one. */
    passageId?: string;
    /** The line's text, trimmed. */
    text?: string;
};

export const ERROR_STATUS: Record<TApiErrorCode, number> = {
    bad_request: 400,
    not_found: 404,
    stale: 409,
    referenced: 409,
    exists: 409,
    invalid: 422,
    not_implemented: 501,
    internal: 500,
};
