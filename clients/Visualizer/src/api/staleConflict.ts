import { type TImageDto, type TLocationDto, type TSourceDto, isImageOwner } from '@story/protocol';
import { ApiError } from './ApiError';

type TStaleError<T> = ApiError & { readonly current: T | null };

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const isVersioned = (value: unknown): value is Record<string, unknown> & { version: string } =>
    isObject(value) && typeof value.version === 'string';

export const isSourceDto = (value: unknown): value is TSourceDto =>
    isVersioned(value) && typeof value.file === 'string' && typeof value.text === 'string';

export const isImageDto = (value: unknown): value is TImageDto =>
    isVersioned(value) &&
    typeof value.owner === 'string' &&
    isImageOwner(value.owner) &&
    typeof value.id === 'string' &&
    typeof value.file === 'string' &&
    (value.url === null || typeof value.url === 'string');

export const isLocationDto = (value: unknown): value is TLocationDto =>
    isVersioned(value) && value.kind === 'locations' && typeof value.id === 'string';

export const isStaleError = <T>(e: unknown, isCurrent: (value: unknown) => value is T): e is TStaleError<T> =>
    e instanceof ApiError && e.isStale && (e.current === null || isCurrent(e.current));
