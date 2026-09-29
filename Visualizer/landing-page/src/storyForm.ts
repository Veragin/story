import { STORY_LIMITS, type TCreateStoryBody, type TStoryDto, type TUpdateStoryBody } from '@story/visualizer-protocol';

/**
 * The create / edit story form (`CreateStoryDialog`, `EditStoryDialog`) as the user types it:
 * the map size as text, the password twice. `validateStoryForm` checks what the server checks
 * (`STORY_LIMITS`, `server/src/stories/storyInput.ts`), so a bad form is caught before sending.
 */
export type TStoryFormValue = {
    name: string;
    author: string;
    password: string;
    passwordConfirm: string;
    description: string;
    mapWidth: string;
    mapHeight: string;
    public: boolean;
};

export type TStoryFormErrors = Partial<Record<keyof TStoryFormValue, string>>;

/** A new story's defaults: the plan's example map size (40 × 30). */
export const EMPTY_STORY_FORM: TStoryFormValue = {
    name: '',
    author: '',
    password: '',
    passwordConfirm: '',
    description: '',
    mapWidth: '40',
    mapHeight: '30',
    public: false,
};

/** The Edit form of a story: its info, with the password fields empty ("leave empty to keep"). */
export const storyFormOf = (story: TStoryDto): TStoryFormValue => ({
    name: story.name,
    author: story.author,
    password: '',
    passwordConfirm: '',
    description: story.description,
    mapWidth: String(story.mapSize.width),
    mapHeight: String(story.mapSize.height),
    public: story.public,
});

const L = STORY_LIMITS;

const mapSideError = (text: string) => {
    const n = Number(text.trim());
    if (text.trim() === '' || !Number.isInteger(n) || n < L.mapSizeMin || n > L.mapSizeMax) {
        return _('A whole number from %d to %d', L.mapSizeMin, L.mapSizeMax);
    }
    return undefined;
};

/**
 * The errors of a form, by field (empty when it is valid). `passwordRequired`: a new story needs
 * one; an edit may leave both password fields empty to keep the current password.
 */
export const validateStoryForm = (
    value: TStoryFormValue,
    { passwordRequired }: { passwordRequired: boolean }
): TStoryFormErrors => {
    const errors: TStoryFormErrors = {};
    const name = value.name.trim();
    if (name === '') errors.name = _('The name is required');
    else if (name.length > L.nameMaxLength) errors.name = _('At most %d characters', L.nameMaxLength);
    if (value.author.trim().length > L.authorMaxLength) {
        errors.author = _('At most %d characters', L.authorMaxLength);
    }
    if (value.description.length > L.descriptionMaxLength) {
        errors.description = _('At most %d characters', L.descriptionMaxLength);
    }
    if (passwordRequired || value.password !== '' || value.passwordConfirm !== '') {
        if (value.password.length < L.passwordMinLength) {
            errors.password = _('At least %d characters', L.passwordMinLength);
        } else if (value.password.length > L.passwordMaxLength) {
            errors.password = _('At most %d characters', L.passwordMaxLength);
        } else if (value.passwordConfirm !== value.password) {
            errors.passwordConfirm = _('The passwords do not match');
        }
    }
    const width = mapSideError(value.mapWidth);
    if (width) errors.mapWidth = width;
    const height = mapSideError(value.mapHeight);
    if (height) errors.mapHeight = height;
    return errors;
};

export const hasErrors = (errors: TStoryFormErrors) => Object.keys(errors).length > 0;

/** `POST /api/stories` from a valid form. */
export const toCreateBody = (value: TStoryFormValue): TCreateStoryBody => ({
    name: value.name.trim(),
    author: value.author.trim(),
    password: value.password,
    description: value.description,
    mapSize: { width: Number(value.mapWidth), height: Number(value.mapHeight) },
    public: value.public,
});

/** `PUT /api/stories/:id/info` from a valid form: no `mapSize` (read-only), no empty password. */
export const toUpdateBody = (value: TStoryFormValue, version: string): TUpdateStoryBody => ({
    version,
    name: value.name.trim(),
    author: value.author.trim(),
    description: value.description,
    public: value.public,
    ...(value.password !== '' && { password: value.password }),
});
