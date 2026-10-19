/**
 * Every non-2xx reply carries a `TApiErrorBody`.
 *
 * | status | `error`                 | extra fields  | meaning                                              |
 * | ------ | ----------------------- | ------------- | ---------------------------------------------------- |
 * | 400    | `bad_request`           | `message`     | malformed JSON / missing or invalid fields           |
 * | 401    | `unauthorized`          | `message`     | the story is locked: log in with its password first  |
 * | 403    | `forbidden`             | `message`     | logged in, but this request is not allowed           |
 * | 404    | `not_found`             | `message`     | no such route, story or resource                     |
 * | 409    | `stale`                 | `current`     | the body's `version` is not the one on disk; `current` is the fresh DTO (or `null` if deleted) |
 * | 409    | `referenced`            | `references`  | delete / remove refused, other files still point here |
 * | 409    | `exists`                | `message`     | create refused, the id is taken                      |
 * | 409    | `git_not_configured`    | `message`     | the story has no git config yet                      |
 * | 409    | `git_dirty`             | `message`     | pull / checkout refused: uncommitted changes         |
 * | 409    | `git_conflict`          | `files`       | the merge conflicted and was aborted; the tree is clean |
 * | 409    | `git_rejected`          | `message`     | push rejected, the remote is ahead: pull first       |
 * | 409    | `git_auth`              | `message`     | the remote refused the token (not 401: the story is not locked) |
 * | 409    | `git_nothing_to_commit` | `message`     | commit refused, the tree is clean                    |
 * | 422    | `invalid`               | `diagnostics` | the edit does not type-check; nothing was written    |
 * | 429    | `too_many_requests`     | `message`     | too many failed logins, try again later              |
 * | 501    | `not_implemented`       |               | route is in the protocol, handler not written yet    |
 * | 500    | `internal`              | `message`     | bug                                                  |
 * | 502    | `git_remote`            | `message`     | network or unknown remote error, token scrubbed      |
 * | 503    | `git_unavailable`       | `message`     | no `GIT_TOKEN_KEY` or no `git` on the server         |
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
    | 'internal'
    | 'git_unavailable'
    | 'git_not_configured'
    | 'git_dirty'
    | 'git_conflict'
    | 'git_rejected'
    | 'git_auth'
    | 'git_remote'
    | 'git_nothing_to_commit';

export type TApiErrorBody = {
    error: TApiErrorCode;
    message?: string;
    diagnostics?: TDiagnosticDto[];
    references?: TReferenceDto[];
    /** For `stale`: the current DTO, or `null` when deleted. */
    current?: unknown;
    /** For `git_conflict`: the conflicting paths, relative to the story folder. */
    files?: string[];
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
    git_unavailable: 503,
    git_not_configured: 409,
    git_dirty: 409,
    git_conflict: 409,
    git_rejected: 409,
    git_auth: 409,
    git_remote: 502,
    git_nothing_to_commit: 409,
};
