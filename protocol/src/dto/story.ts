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
    emailMaxLength: 255,
    passwordMinLength: 6,
    passwordMaxLength: 256,
    /** Each side of the map, in whole tiles. */
    mapSizeMin: 1,
    mapSizeMax: 500,
} as const;

export const STORY_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isStoryEmail = (value: unknown): value is string =>
    typeof value === 'string' && STORY_EMAIL_PATTERN.test(value);

/** A story's metadata (its database row) without the password hash. */
export type TStoryDto = {
    id: string;
    name: string;
    author: string;
    description: string;
    mapSize: TMapSizeDto;
    /** Playable in SinglePlayer without the password; editing still needs it. */
    public: boolean;
};

export type TStoryListItemDto = TStoryDto & { unlocked: boolean };

/** What `getStoryInfo` answers without a grant (a public story). */
export type TPublicStoryInfoDto = { access: 'public' } & Pick<TStoryDto, 'id' | 'name' | 'author' | 'description'>;

/** What `getStoryInfo` answers with a grant. */
export type TEditStoryInfoDto = { access: 'edit' } & TStoryDto &
    TVersioned & {
        /** `LANDING_IMAGE_FILE` exists; derived from the file, not stored. Upload it as the `story` owner's image. */
        hasLandingImage: boolean;
        /** `''` when none. */
        email: string;
    };

export type TStoryInfoDto = TPublicStoryInfoDto | TEditStoryInfoDto;

/** `password` is plain; the server stores only its hash. `email` is optional and checked by `isStoryEmail`. */
export type TCreateStoryBody = Omit<TStoryDto, 'id'> & { password: string; email?: string };

/**
 * `mapSize` may be sent only unchanged; an absent or empty `password` keeps the current one.
 * An absent `email` keeps the current one, `''` clears it.
 */
export type TUpdateStoryBody = TVersionedBody & Partial<Omit<TStoryDto, 'id'> & { password: string; email: string }>;

/** The `importStory` form fields; the map size comes from the zip. */
export type TImportStoryBody = Omit<TCreateStoryBody, 'mapSize'>;

/** The `exportStory` response type. */
export const STORY_ZIP_CONTENT_TYPE = 'application/zip';

export const MAX_STORY_ZIP_BYTES = 50 * 1024 * 1024;

/** `importStory`, `addStoryFiles`: a form with the zip in `STORY_IMPORT_ZIP_FIELD` (the CSRF check wants this type). */
export const STORY_IMPORT_CONTENT_TYPE = 'multipart/form-data';

export const STORY_IMPORT_ZIP_FIELD = 'zip';

/** The `importStory` form: every field is text, `public` is `"true"` or `"false"`. */
export const storyImportForm = (zip: Blob, body: TImportStoryBody, fileName = 'story.zip'): FormData => {
    const form = new FormData();
    form.set('name', body.name);
    form.set('author', body.author);
    form.set('description', body.description);
    form.set('email', body.email ?? '');
    form.set('password', body.password);
    form.set('public', String(body.public));
    form.set(STORY_IMPORT_ZIP_FIELD, zip, fileName);
    return form;
};

/** The `addStoryFiles` form. */
export const storyFilesForm = (zip: Blob, fileName = 'story.zip'): FormData => {
    const form = new FormData();
    form.set(STORY_IMPORT_ZIP_FIELD, zip, fileName);
    return form;
};

export type TLoginBody = { password: string };

/** Compared to the story's email trimmed and case-insensitively. */
export type TRequestPasswordResetBody = { email: string };

/** `token` comes from the reset link; `password` is plain, with the `STORY_LIMITS` lengths. */
export type TResetPasswordBody = { token: string; password: string };

/** The reset link's query parameter with the token, next to `story` with the story id. */
export const PASSWORD_RESET_TOKEN_PARAM = 'resetToken';

export type TSessionDto = { storyIds: string[] };

export type TStoryAccessDto = {
    /** The session holds a grant for the story. */
    canEdit: boolean;
    /** The story is `public`, or `canEdit`. */
    canPlay: boolean;
};

/** Holds an opaque token; the grants live on the server. */
export const SESSION_COOKIE = 'story_session';
