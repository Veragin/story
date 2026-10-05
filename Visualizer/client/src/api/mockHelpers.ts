import type { TApiErrorBody, TDiagnosticDto } from '@story/visualizer-protocol';
import { ApiError } from './ApiError';

export const fail = (status: number, body: TApiErrorBody): never => {
    throw new ApiError(status, body);
};

export const notFound = (what: string) => fail(404, { error: 'not_found', message: `No ${what}` });

export const invalid = (diagnostics: TDiagnosticDto[]) => fail(422, { error: 'invalid', diagnostics });

export const clone = <T>(value: T): T => structuredClone(value);
