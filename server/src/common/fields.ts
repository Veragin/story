import { HttpError } from './HttpError';

export const textField = (
    body: Record<string, unknown>,
    field: string,
    max: number,
    { required = false, trim = true } = {}
) => {
    const value = body[field];
    if (typeof value !== 'string') throw HttpError.badRequest(`Field "${field}" must be a string`);
    const out = trim ? value.trim() : value;
    if (required && out === '') throw HttpError.badRequest(`Field "${field}" must not be empty`);
    if (out.length > max) throw HttpError.badRequest(`Field "${field}" is longer than ${max} characters`);
    return out;
};

export const flagField = (body: Record<string, unknown>, field: string) => {
    const value = body[field];
    if (typeof value !== 'boolean') throw HttpError.badRequest(`Field "${field}" must be true or false`);
    return value;
};

export const rejectUnknownFields = (body: Record<string, unknown>, known: readonly string[]) => {
    const unknown = Object.keys(body).filter((k) => !known.includes(k));
    if (unknown.length > 0) throw HttpError.badRequest(`Unknown field(s): ${unknown.join(', ')}`);
};
