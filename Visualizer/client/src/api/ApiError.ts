import type {
    TApiErrorBody,
    TApiErrorCode,
    TDiagnosticDto,
    TReferenceDto,
    TRouteName,
} from '@story/visualizer-protocol';

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

    get isStale() {
        return this.body.error === 'stale';
    }

    get isReferenced() {
        return this.body.error === 'referenced';
    }

    get isInvalid() {
        return this.body.error === 'invalid';
    }

    get isNotFound() {
        return this.status === 404;
    }

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
