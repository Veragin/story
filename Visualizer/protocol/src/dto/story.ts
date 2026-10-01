import type { TVersioned, TVersionedBody } from './common';

/** The story's folder name: made once from the name at creation, never changed. */
export const STORY_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

export const isStoryId = (value: unknown): value is string => typeof value === 'string' && STORY_ID_PATTERN.test(value);

/** In tiles; read-only after creation. */
export type TMapSizeDto = { width: number; height: number };

/** Lengths are in UTF-16 code units after trimming; `name` must not be empty. */
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

/** `story.json` without its password hash. */
export type TStoryDto = {
    id: string;
    name: string;
    author: string;
    description: string;
    mapSize: TMapSizeDto;
    /** Playable in SingleEngine without the password; editing still needs it. */
    public: boolean;
};

export type TStoryListItemDto = TStoryDto & { unlocked: boolean };

export type TStoryInfoDto = TStoryDto & TVersioned;

/** `password` is plain; the server stores only its hash. */
export type TCreateStoryBody = Omit<TStoryDto, 'id'> & { password: string };

/** `mapSize` may be sent only unchanged; an absent or empty `password` keeps the current one. */
export type TUpdateStoryBody = TVersionedBody & Partial<Omit<TStoryDto, 'id'> & { password: string }>;

export const STORY_ZIP_CONTENT_TYPE = 'application/zip';

export const MAX_STORY_ZIP_BYTES = 50 * 1024 * 1024;

export type TLoginBody = { password: string };

export type TSessionDto = { storyIds: string[] };

export type TStoryAccessDto = {
    /** The session holds a grant for the story. */
    canEdit: boolean;
    /** The story is `public`, or `canEdit`. */
    canPlay: boolean;
};

/** Holds an opaque token; the grants live on the server. */
export const SESSION_COOKIE = 'story_session';
