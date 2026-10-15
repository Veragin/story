import { STORY_LIMITS, type TMapSizeDto } from '@story/visualizer-protocol';
import { hashPassword } from '../auth/password';
import { isPlainObject } from '../http/body';
import { HttpError } from '../http/HttpError';
import type { TStoryFile } from './StoryStore';

const L = STORY_LIMITS;

const text = (body: Record<string, unknown>, field: string, max: number, { required = false, trim = true } = {}) => {
    const value = body[field];
    if (typeof value !== 'string') throw HttpError.badRequest(`Field "${field}" must be a string`);
    const out = trim ? value.trim() : value;
    if (required && out === '') throw HttpError.badRequest(`Field "${field}" must not be empty`);
    if (out.length > max) throw HttpError.badRequest(`Field "${field}" is longer than ${max} characters`);
    return out;
};

const flag = (body: Record<string, unknown>, field: string) => {
    const value = body[field];
    if (typeof value !== 'boolean') throw HttpError.badRequest(`Field "${field}" must be true or false`);
    return value;
};

const password = (value: unknown) => {
    if (typeof value !== 'string') throw HttpError.badRequest('Field "password" must be a string');
    if (value.length < L.passwordMinLength) {
        throw HttpError.badRequest(`Field "password" must be at least ${L.passwordMinLength} characters`);
    }
    if (value.length > L.passwordMaxLength) {
        throw HttpError.badRequest(`Field "password" is longer than ${L.passwordMaxLength} characters`);
    }
    return value;
};

const mapSize = (value: unknown): TMapSizeDto => {
    const side = (v: unknown): v is number =>
        typeof v === 'number' && Number.isInteger(v) && v >= L.mapSizeMin && v <= L.mapSizeMax;
    if (!isPlainObject(value) || !side(value.width) || !side(value.height)) {
        throw HttpError.badRequest(
            `Field "mapSize" must be { width, height }, whole tiles from ${L.mapSizeMin} to ${L.mapSizeMax}`
        );
    }
    return { width: value.width, height: value.height };
};

export const parseCreateStoryBody = async (body: Record<string, unknown>): Promise<TStoryFile> => {
    const withDefaults = { author: '', description: '', public: false, ...body };
    const plain = password(body.password);
    return {
        name: text(withDefaults, 'name', L.nameMaxLength, { required: true }),
        author: text(withDefaults, 'author', L.authorMaxLength),
        password: await hashPassword(plain),
        mapSize: mapSize(body.mapSize),
        description: text(withDefaults, 'description', L.descriptionMaxLength, { trim: false }),
        public: flag(withDefaults, 'public'),
    };
};

const UPDATE_FIELDS = ['version', 'id', 'name', 'author', 'description', 'public', 'password', 'mapSize'];

export const applyUpdateStoryBody = async (
    storyId: string,
    current: TStoryFile,
    body: Record<string, unknown>
): Promise<TStoryFile> => {
    const unknown = Object.keys(body).filter((k) => !UPDATE_FIELDS.includes(k));
    if (unknown.length > 0) throw HttpError.badRequest(`Unknown field(s): ${unknown.join(', ')}`);
    if (body.id !== undefined && body.id !== storyId) throw HttpError.badRequest('Field "id" is read-only');
    if (body.mapSize !== undefined) {
        const size = isPlainObject(body.mapSize) ? body.mapSize : {};
        if (size.width !== current.mapSize.width || size.height !== current.mapSize.height) {
            throw HttpError.badRequest('Field "mapSize" is read-only (the map cannot be resized yet)');
        }
    }
    const next = { ...current };
    if (body.name !== undefined) next.name = text(body, 'name', L.nameMaxLength, { required: true });
    if (body.author !== undefined) next.author = text(body, 'author', L.authorMaxLength);
    if (body.description !== undefined) {
        next.description = text(body, 'description', L.descriptionMaxLength, { trim: false });
    }
    if (body.public !== undefined) next.public = flag(body, 'public');
    if (body.password !== undefined && body.password !== '')
        next.password = await hashPassword(password(body.password));
    return next;
};
