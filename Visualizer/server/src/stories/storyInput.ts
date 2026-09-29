import { STORY_LIMITS, type TMapSizeDto } from '@story/visualizer-protocol';
import { hashPassword } from '../auth/password';
import { HttpError } from '../http/HttpError';
import type { TStoryFile } from './StoryStore';

/**
 * Validation of the story bodies (multiple stories, phase 5): `POST /api/stories` and
 * `PUT /api/stories/:storyId/info`. Limits are `STORY_LIMITS` (protocol), so the landing page can
 * check the same thing before sending. Every problem is a 400 naming the field.
 */

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
    if (typeof body[field] !== 'boolean') throw HttpError.badRequest(`Field "${field}" must be true or false`);
    return body[field] as boolean;
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
    const side = (v: unknown) => typeof v === 'number' && Number.isInteger(v) && v >= L.mapSizeMin && v <= L.mapSizeMax;
    const o = value as Record<string, unknown> | null;
    if (typeof o !== 'object' || o === null || !side(o.width) || !side(o.height)) {
        throw HttpError.badRequest(
            `Field "mapSize" must be { width, height }, whole tiles from ${L.mapSizeMin} to ${L.mapSizeMax}`
        );
    }
    return { width: o.width as number, height: o.height as number };
};

/**
 * `POST /api/stories`: the new `story.json`, with the password hashed. `name`, `password` and
 * `mapSize` are required; `author` and `description` default to `''`, `public` to `false`.
 */
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

/** What `PUT /info` may carry besides the editable fields: the DTO's own, when sent back unchanged. */
const UPDATE_FIELDS = ['version', 'id', 'name', 'author', 'description', 'public', 'password', 'mapSize'];

/**
 * `PUT /api/stories/:storyId/info`: `current` with the body's fields applied (partial: an absent
 * field is kept). An empty or absent `password` keeps the current hash. `mapSize` is read-only
 * (plan D6) and `id` is the folder name: both may be sent, but only unchanged.
 */
export const applyUpdateStoryBody = async (
    storyId: string,
    current: TStoryFile,
    body: Record<string, unknown>
): Promise<TStoryFile> => {
    const unknown = Object.keys(body).filter((k) => !UPDATE_FIELDS.includes(k));
    if (unknown.length > 0) throw HttpError.badRequest(`Unknown field(s): ${unknown.join(', ')}`);
    if (body.id !== undefined && body.id !== storyId) throw HttpError.badRequest('Field "id" is read-only');
    if (body.mapSize !== undefined) {
        const size = body.mapSize as Partial<TMapSizeDto> | null;
        if (size?.width !== current.mapSize.width || size?.height !== current.mapSize.height) {
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
