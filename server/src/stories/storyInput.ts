import { isStoryEmail, STORY_LIMITS, type TMapSizeDto } from '@story/protocol';
import { hashPassword } from '../auth/password';
import { flagField, rejectUnknownFields, textField } from '../common/fields';
import { errorMessage, HttpError } from '../common/HttpError';
import { isPlainObject } from '../common/isPlainObject';
import { decodeMapFile, MAP_FILE } from '../json/mapFile';
import type { TStoryFile } from './storyFile';

const L = STORY_LIMITS;

export const password = (value: unknown) => {
    if (typeof value !== 'string') throw HttpError.badRequest('Field "password" must be a string');
    if (value.length < L.passwordMinLength) {
        throw HttpError.badRequest(`Field "password" must be at least ${L.passwordMinLength} characters`);
    }
    if (value.length > L.passwordMaxLength) {
        throw HttpError.badRequest(`Field "password" is longer than ${L.passwordMaxLength} characters`);
    }
    return value;
};

const emailField = (body: Record<string, unknown>) => {
    const email = textField(body, 'email', L.emailMaxLength);
    if (email !== '' && !isStoryEmail(email)) throw HttpError.badRequest('Field "email" is not an email address');
    return email;
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
    const withDefaults = { author: '', description: '', public: false, email: '', ...body };
    const plain = password(body.password);
    return {
        name: textField(withDefaults, 'name', L.nameMaxLength, { required: true }),
        author: textField(withDefaults, 'author', L.authorMaxLength),
        password: await hashPassword(plain),
        mapSize: size(),
        description: textField(withDefaults, 'description', L.descriptionMaxLength, { trim: false }),
        public: flagField(withDefaults, 'public'),
        email: emailField(withDefaults),
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

export const storyMapSize = (bytes: Uint8Array | undefined, source: string): TMapSizeDto => {
    if (!bytes) throw HttpError.badRequest(`The ${source} has no ${MAP_FILE}: its map size is the story's`);
    let size: TMapSizeDto;
    try {
        const { width, height } = decodeMapFile(JSON.parse(new TextDecoder().decode(bytes)));
        size = { width, height };
    } catch (e) {
        throw HttpError.badRequest(`The ${source}'s ${MAP_FILE} is not valid: ${errorMessage(e)}`);
    }
    if (!isMapSide(size.width) || !isMapSide(size.height)) {
        throw HttpError.badRequest(
            `The ${source}'s ${MAP_FILE} is ${size.width}x${size.height} tiles; each side must be ${L.mapSizeMin} to ${L.mapSizeMax}`
        );
    }
    return size;
};

export const zipMapSize = (files: ReadonlyMap<string, Uint8Array>): TMapSizeDto =>
    storyMapSize(files.get(MAP_FILE), 'zip');

// `access` and `hasLandingImage` are derived: accepted so the whole info can be sent back, but never applied
const UPDATE_FIELDS = [
    'version',
    'id',
    'name',
    'author',
    'description',
    'public',
    'email',
    'password',
    'mapSize',
    'hasLandingImage',
    'access',
];

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
    rejectUnknownFields(body, UPDATE_FIELDS);
    if (body.id !== undefined && body.id !== storyId) throw HttpError.badRequest('Field "id" is read-only');
    if (body.mapSize !== undefined) {
        const size = isPlainObject(body.mapSize) ? body.mapSize : {};
        if (size.width !== current.mapSize.width || size.height !== current.mapSize.height) {
            throw HttpError.badRequest('Field "mapSize" is read-only (the map cannot be resized yet)');
        }
    }
    const next = { ...current };
    if (body.name !== undefined) next.name = textField(body, 'name', L.nameMaxLength, { required: true });
    if (body.author !== undefined) next.author = textField(body, 'author', L.authorMaxLength);
    if (body.description !== undefined) {
        next.description = textField(body, 'description', L.descriptionMaxLength, { trim: false });
    }
    if (body.public !== undefined) next.public = flagField(body, 'public');
    if (body.email !== undefined) next.email = emailField(body);
    const hash = passwordHash();
    if (hash !== undefined) next.password = hash;
    return next;
};
