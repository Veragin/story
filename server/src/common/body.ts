import { HttpError } from './HttpError';
import { isPlainObject } from './isPlainObject';

export const jsonObjectBody = (body: unknown): Record<string, unknown> => {
    if (!isPlainObject(body)) throw HttpError.badRequest('Expected a JSON object body');
    return body;
};

export const requireString = (body: Record<string, unknown>, field: string): string => {
    const value = body[field];
    if (typeof value !== 'string' || value === '') {
        throw HttpError.badRequest(`Field "${field}" must be a non-empty string`);
    }
    return value;
};
