import type { TVersioned, TVersionedBody } from './common';

/**
 * Stories (multiple stories): every story is a folder `stories/<id>/` holding `data/`, `types/`
 * and `story.json`. `story.json` carries the password hash, so it never reaches a client as-is:
 * the server answers with `TStoryDto`, which has everything but the password.
 */

/**
 * A story id: the folder name, made once from the name at creation and never changed (plan D3).
 * Lowercase letters, digits and `-`, at most 64 characters, not starting with `-`.
 */
export const STORY_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

export const isStoryId = (value: unknown): value is string => typeof value === 'string' && STORY_ID_PATTERN.test(value);

/** Map size in tiles. Set at creation, read-only afterwards (plan D6). */
export type TMapSizeDto = { width: number; height: number };

/**
 * What the server accepts when a story is created or edited (phase 5). Lengths are in UTF-16
 * code units after trimming; `name` must not be empty, `author` and `description` may be.
 */
export const STORY_LIMITS = {
    nameMaxLength: 100,
    authorMaxLength: 100,
    descriptionMaxLength: 5000,
    passwordMinLength: 6,
    passwordMaxLength: 256,
    /** Each side of the map, in whole tiles. */
    mapSizeMin: 1,
    mapSizeMax: 500,
} as const;

/** `GET /api/stories` — one story, without its password hash. */
export type TStoryDto = {
    id: string;
    name: string;
    author: string;
    description: string;
    mapSize: TMapSizeDto;
    /** Anyone may play it in SingleEngine without the password; editing still needs it. */
    public: boolean;
};

/** `GET /api/stories` — a story plus whether this browser's session has unlocked it. */
export type TStoryListItemDto = TStoryDto & { unlocked: boolean };

/**
 * `GET/PUT /api/stories/:storyId/info` — the story's `story.json` without the password, with the
 * `version` (the hash of the file) that an edit must send back.
 */
export type TStoryInfoDto = TStoryDto & TVersioned;

/**
 * Create a story (phase 5). `password` is the plain password; the server stores only its hash.
 * The id is made from the name (plan D3). See `STORY_LIMITS`.
 */
export type TCreateStoryBody = Omit<TStoryDto, 'id'> & { password: string };

/**
 * Edit a story's info (phase 5). Partial like every `PUT`. `mapSize` cannot change (plan D6): it
 * may be sent only unchanged. `password` is optional: absent or empty keeps the current one.
 */
export type TUpdateStoryBody = TVersionedBody & Partial<Omit<TStoryDto, 'id'> & { password: string }>;

/** The content type of a story zip: `GET …/export` answers it, `POST /api/stories/import` takes it. */
export const STORY_ZIP_CONTENT_TYPE = 'application/zip';

/** The largest zip `POST /api/stories/import` accepts. */
export const MAX_STORY_ZIP_BYTES = 50 * 1024 * 1024;

/** Unlock a story (phase 4): `POST /api/stories/:storyId/login`. */
export type TLoginBody = { password: string };

/** `GET /api/session` — the stories this browser's session has unlocked (phase 4). */
export type TSessionDto = { storyIds: string[] };

/** `GET /api/stories/:storyId/access` — what this browser may do with a story (phase 4). */
export type TStoryAccessDto = {
    /** The session holds a grant for the story: every story route is open to it. */
    canEdit: boolean;
    /** It may be played in SingleEngine: the story is `public`, or `canEdit`. */
    canPlay: boolean;
};

/** The session cookie. It holds an opaque token; the grants live on the server. */
export const SESSION_COOKIE = 'story_session';
