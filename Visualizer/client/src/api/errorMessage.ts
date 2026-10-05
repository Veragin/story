import { ApiError } from './ApiError';

export const errorMessage = (e: unknown): string => {
    if (e instanceof ApiError) {
        if (e.isNotImplemented) return 'The server does not implement this route yet (501).';
        return e.body.message ? `${e.body.error}: ${e.body.message}` : `${e.body.error} (${e.status})`;
    }
    return e instanceof Error ? e.message : String(e);
};
