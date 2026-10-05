import type { TDiagnosticDto, TReferenceDto } from '@story/visualizer-protocol';
import { ApiError, errorMessage } from '../api';

export type TWriteFailure =
    | { status: 'invalid'; diagnostics: TDiagnosticDto[] }
    | { status: 'referenced'; references: TReferenceDto[] }
    | { status: 'stale'; current: unknown }
    | { status: 'exists'; message: string }
    | { status: 'error'; message: string };

export type TWriteResult<T> = { status: 'ok'; value: T } | TWriteFailure;

export const failureOf = (e: unknown): TWriteFailure => {
    if (!(e instanceof ApiError)) return { status: 'error', message: errorMessage(e) };
    if (e.isInvalid) return { status: 'invalid', diagnostics: e.diagnostics };
    if (e.isReferenced) return { status: 'referenced', references: e.references };
    if (e.isStale) return { status: 'stale', current: e.current };
    if (e.code === 'exists') return { status: 'exists', message: errorMessage(e) };
    return { status: 'error', message: errorMessage(e) };
};

export const writeResult = async <T>(call: () => Promise<T>): Promise<TWriteResult<T>> => {
    try {
        return { status: 'ok', value: await call() };
    } catch (e) {
        return failureOf(e);
    }
};

export const failureMessage = (failure: TWriteFailure, what: string): string => {
    switch (failure.status) {
        case 'invalid':
            return `${what}: ${failure.diagnostics.map((d) => d.message).join('; ')}`;
        case 'error':
        case 'exists':
            return `${what}: ${failure.message}`;
        default:
            return `${what} (${failure.status}).`;
    }
};
