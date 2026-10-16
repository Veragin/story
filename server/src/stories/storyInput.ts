import { STORY_LIMITS, type TMapSizeDto } from '@story/protocol';
import { hashPassword } from '../auth/password';
import { errorMessage, HttpError } from '../common/HttpError';
import { isPlainObject } from '../common/isPlainObject';
import { decodeMapFile, MAP_FILE } from '../json/mapFile';
import type { TStoryFile } from './storyFile';

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

const isMapSide = (v: unknown): v is number =>
    typeof v === 'number' && Number.isInteger(v) && v >= L.mapSizeMin && v <= L.mapSizeMax;

const mapSize = (value: unknown): TMapSizeDto => {
    if (!isPlainObject(value) || !isMapSide(value.width) || !isMapSide(value.height)) {
        throw HttpError.badRequest(
            `Field "mapSize" must be { width, height }, whole tiles from ${L.mapSizeMin} to ${L.mapSizeMax}`
        );
    }
    return { width: value.width, height: value.height };
};

const parseNewStory = async (body: Record<string, unknown>, size: () => TMapSizeDto): Promise<TStoryFile> => {
    const withDefaults = { author: '', description: '', public: false, ...body };
    const plain = password(body.password);
    return {
        name: text(withDefaults, 'name', L.nameMaxLength, { required: true }),
        author: text(withDefaults, 'author', L.authorMaxLength),
        password: await hashPassword(plain),
        mapSize: size(),
        description: text(withDefaults, 'description', L.descriptionMaxLength, { trim: false }),
        public: flag(withDefaults, 'public'),
    };
};

export const parseCreateStoryBody = (body: Record<string, unknown>): Promise<TStoryFile> =>
    parseNewStory(body, () => mapSize(body.mapSize));

const formFlag = (value: unknown): unknown => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
};

// form fields are all text: `public` arrives as "true" / "false"
const formBody = (fields: unknown): Record<string, unknown> => {
    const body = isPlainObject(fields) ? { ...fields } : {};
    if (body.public !== undefined) body.public = formFlag(body.public);
    return body;
};

export const parseImportStoryBody = (fields: unknown, size: TMapSizeDto): Promise<TStoryFile> =>
    parseNewStory(formBody(fields), () => size);

export const zipMapSize = (files: ReadonlyMap<string, Uint8Array>): TMapSizeDto => {
    const bytes = files.get(MAP_FILE);
    if (!bytes) throw HttpError.badRequest(`The zip has no ${MAP_FILE}: its map size is the story's`);
    let size: TMapSizeDto;
    try {
        const { width, height } = decodeMapFile(JSON.parse(new TextDecoder().decode(bytes)));
        size = { width, height };
    } catch (e) {
        throw HttpError.badRequest(`The zip's ${MAP_FILE} is not valid: ${errorMessage(e)}`);
    }
    if (!isMapSide(size.width) || !isMapSide(size.height)) {
        throw HttpError.badRequest(
            `The zip's ${MAP_FILE} is ${size.width}x${size.height} tiles; each side must be ${L.mapSizeMin} to ${L.mapSizeMax}`
        );
    }
    return size;
};

const UPDATE_FIELDS = ['version', 'id', 'name', 'author', 'description', 'public', 'password', 'mapSize'];

export type TPasswordHash = () => string | undefined;

// scrypt runs before the transaction, so no pooled connection waits on it; an invalid password still throws in order
export const hashUpdatePassword = async (body: Record<string, unknown>): Promise<TPasswordHash> => {
    if (body.password === undefined || body.password === '') return () => undefined;
    try {
        const hash = await hashPassword(password(body.password));
        return () => hash;
    } catch (e) {
        return () => {
            throw e;
        };
    }
};

export const applyUpdateStoryBody = (
    storyId: string,
    current: TStoryFile,
    body: Record<string, unknown>,
    passwordHash: TPasswordHash
): TStoryFile => {
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
    const hash = passwordHash();
    if (hash !== undefined) next.password = hash;
    return next;
};
