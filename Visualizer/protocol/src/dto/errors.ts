/**
 * Every non-2xx reply carries a `TApiErrorBody`.
 *
 * | status | `error`            | extra fields     | meaning                                              |
 * | ------ | ------------------ | ---------------- | ---------------------------------------------------- |
 * | 400    | `bad_request`      | `message`        | malformed JSON / missing or invalid fields           |
 * | 401    | `unauthorized`     | `message`        | the story is locked: log in with its password first  |
 * | 403    | `forbidden`        | `message`        | logged in, but this request is not allowed           |
 * | 404    | `not_found`        | `message`        | no such route, story or resource                     |
 * | 409    | `stale`            | `current`        | the body's `version` is not the one on disk; `current` is the fresh DTO (or `null` if deleted) |
 * | 409    | `referenced`       | `references`     | delete / remove refused, other files still point here |
 * | 409    | `exists`           | `message`        | create refused, the id is taken                      |
 * | 422    | `invalid`          | `diagnostics`    | the edit does not type-check; nothing was written    |
 * | 429    | `too_many_requests`| `message`        | too many failed logins, try again later              |
 * | 501    | `not_implemented`  |                  | route is in the protocol, handler not written yet    |
 * | 500    | `internal`         | `message`        | bug                                                  |
 */
export type TApiErrorCode =
    | 'bad_request'
    | 'unauthorized'
    | 'forbidden'
    | 'not_found'
    | 'stale'
    | 'referenced'
    | 'exists'
    | 'invalid'
    | 'too_many_requests'
    | 'not_implemented'
    | 'internal';

export type TApiErrorBody = {
    error: TApiErrorCode;
    message?: string;
    diagnostics?: TDiagnosticDto[];
    references?: TReferenceDto[];
    /** For `stale`: the current DTO, or `null` when deleted. */
    current?: unknown;
};

/** Positioned in the file that would have been written. */
export type TDiagnosticDto = {
    file: string;
    /** 1-based. */
    line: number;
    /** 1-based. */
    column: number;
    message: string;
    /** TS error number. */
    code?: number;
    /** Dotted DTO field path (`body.0.links.1.cost`), when known. */
    field?: string;
};

export type TReferenceDto = {
    file: string;
    line: number;
    passageId?: string;
    /** The line's text, trimmed. */
    text?: string;
};

export const ERROR_STATUS: Record<TApiErrorCode, number> = {
    bad_request: 400,
    unauthorized: 401,
    forbidden: 403,
    not_found: 404,
    stale: 409,
    referenced: 409,
    exists: 409,
    invalid: 422,
    too_many_requests: 429,
    not_implemented: 501,
    internal: 500,
};
