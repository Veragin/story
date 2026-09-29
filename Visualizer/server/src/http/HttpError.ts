import {
    ERROR_STATUS,
    type TApiErrorBody,
    type TApiErrorCode,
    type TDiagnosticDto,
    type TReferenceDto,
} from '@story/visualizer-protocol';

/**
 * The one error type a handler throws to answer non-2xx. The router turns it into
 * `status` + `TApiErrorBody` (protocol `dto/errors.ts`); anything else thrown becomes a 500.
 *
 *     throw HttpError.notFound(`No chapter "${chapterId}"`);
 *     throw HttpError.stale(currentDto);
 *     throw HttpError.referenced(references);
 *     throw HttpError.invalid(diagnostics);
 */
export class HttpError extends Error {
    readonly status: number;

    constructor(readonly body: TApiErrorBody) {
        super(body.message ?? body.error);
        this.name = 'HttpError';
        this.status = ERROR_STATUS[body.error];
    }

    static of(error: TApiErrorCode, message?: string) {
        return new HttpError({ error, message });
    }

    /** 400 */
    static badRequest(message: string) {
        return HttpError.of('bad_request', message);
    }

    /** 401 — the story is locked (phase 4: no grant for it in the session). */
    static unauthorized(message = 'Log in to this story first') {
        return HttpError.of('unauthorized', message);
    }

    /** 403 */
    static forbidden(message: string) {
        return HttpError.of('forbidden', message);
    }

    /** 404 */
    static notFound(message: string) {
        return HttpError.of('not_found', message);
    }

    /** 409 — the body's `version` does not match the file; `current` is the fresh DTO or `null`. */
    static stale(current: unknown, message = 'The resource changed on disk') {
        return new HttpError({ error: 'stale', message, current });
    }

    /** 409 — delete refused, still referenced. */
    static referenced(references: TReferenceDto[], message = 'Still referenced') {
        return new HttpError({ error: 'referenced', message, references });
    }

    /** 409 — create refused, id taken. */
    static exists(message: string) {
        return HttpError.of('exists', message);
    }

    /** 422 — the edit does not type-check; nothing was written. */
    static invalid(diagnostics: TDiagnosticDto[], message = 'The change does not type-check') {
        return new HttpError({ error: 'invalid', message, diagnostics });
    }

    /** 429 — too many failed logins. */
    static tooManyRequests(message = 'Too many attempts, try again later') {
        return HttpError.of('too_many_requests', message);
    }

    /** 501 */
    static notImplemented(message = 'Not implemented yet') {
        return HttpError.of('not_implemented', message);
    }
}

export const isHttpError = (e: unknown): e is HttpError => e instanceof HttpError;
