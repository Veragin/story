import { HttpError } from './HttpError';

export const pathParam = <T extends string>(value: string, isValid: (v: string) => v is T, what: string): T => {
    if (!isValid(value)) throw HttpError.notFound(`No ${what} "${value}"`);
    return value;
};
