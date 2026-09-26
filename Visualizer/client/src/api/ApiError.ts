import type {
    TApiErrorBody,
    TApiErrorCode,
    TDiagnosticDto,
    TReferenceDto,
    TRouteName,
} from '@story/visualizer-protocol';

/**
 * A non-2xx answer of the Visualizer server (or of `mockApi`, which throws the same thing).
 * `body` is the protocol's `TApiErrorBody`; the getters are the cases a page has to handle:
 *
 *     try { await api.updatePassage(id, body) }
 *     catch (e) {
 *         if (e instanceof ApiError && e.isStale) showReloadOrKeepMine(e.current);
 *         else if (e instanceof ApiError && e.isInvalid) showDiagnostics(e.diagnostics);
 *         else throw e;
 *     }
 */
export class ApiError extends Error {
    constructor(
        readonly status: number,
        readonly body: TApiErrorBody,
        readonly route?: TRouteName
    ) {
        super(body.message ? `${body.error}: ${body.message}` : `${body.error} (${status})`);
        this.name = 'ApiError';
    }

    get code(): TApiErrorCode {
        return this.body.error;
    }

    /** 409 — changed on disk; `current` is the fresh DTO (or `null` when deleted). */
    get isStale() {
        return this.body.error === 'stale';
    }

    /** 409 — still referenced; see `references`. */
    get isReferenced() {
        return this.body.error === 'referenced';
    }

    /** 422 — does not type-check; see `diagnostics`. */
    get isInvalid() {
        return this.body.error === 'invalid';
    }

    get isNotFound() {
        return this.status === 404;
    }

    /** The server is up but the route is still a stub (WP2 not landed). */
    get isNotImplemented() {
        return this.status === 501;
    }

    get current(): unknown {
        return this.body.current;
    }

    get diagnostics(): TDiagnosticDto[] {
        return this.body.diagnostics ?? [];
    }

    get references(): TReferenceDto[] {
        return this.body.references ?? [];
    }
}

export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError;
