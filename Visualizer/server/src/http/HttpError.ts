import {
    ERROR_STATUS,
    type TApiErrorBody,
    type TApiErrorCode,
    type TDiagnosticDto,
    type TReferenceDto,
} from '@story/visualizer-protocol';

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

    static badRequest(message: string) {
        return HttpError.of('bad_request', message);
    }

    static unauthorized(message = 'Log in to this story first') {
        return HttpError.of('unauthorized', message);
    }

    static forbidden(message: string) {
        return HttpError.of('forbidden', message);
    }

    static notFound(message: string) {
        return HttpError.of('not_found', message);
    }

    static noStory(storyId: string) {
        return HttpError.notFound(`No story "${storyId}"`);
    }

    static stale(current: unknown, message = 'The resource changed on disk') {
        return new HttpError({ error: 'stale', message, current });
    }

    static referenced(references: TReferenceDto[], message = 'Still referenced') {
        return new HttpError({ error: 'referenced', message, references });
    }

    static exists(message: string) {
        return HttpError.of('exists', message);
    }

    static invalid(diagnostics: TDiagnosticDto[], message = 'The change does not type-check') {
        return new HttpError({ error: 'invalid', message, diagnostics });
    }

    static tooManyRequests(message = 'Too many attempts, try again later') {
        return HttpError.of('too_many_requests', message);
    }

    static notImplemented(message = 'Not implemented yet') {
        return HttpError.of('not_implemented', message);
    }
}

export const isHttpError = (e: unknown): e is HttpError => e instanceof HttpError;

export const errorMessage = (e: unknown): string => (e instanceof Error ? e.message : String(e));
