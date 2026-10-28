import {
    isStoryEmail,
    STORY_LIMITS,
    type TCreateStoryBody,
    type TEditStoryInfoDto,
    type TUpdateStoryBody,
} from '@story/protocol';

export type TStoryFormMode = 'create' | 'edit';

export type TStoryFormValue = {
    name: string;
    author: string;
    email: string;
    password: string;
    passwordConfirm: string;
    description: string;
    mapWidth: string;
    mapHeight: string;
    public: boolean;
};

export type TStoryFormErrors = Partial<Record<keyof TStoryFormValue, string>>;

export const EMPTY_STORY_FORM: TStoryFormValue = {
    name: '',
    author: '',
    email: '',
    password: '',
    passwordConfirm: '',
    description: '',
    mapWidth: '40',
    mapHeight: '30',
    public: false,
};

export const storyFormOf = (story: TEditStoryInfoDto): TStoryFormValue => ({
    name: story.name,
    author: story.author,
    email: story.email,
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

const emailError = (text: string) => {
    const email = text.trim();
    if (email === '') return undefined;
    if (email.length > L.emailMaxLength) return _('At most %d characters', L.emailMaxLength);
    return isStoryEmail(email) ? undefined : _('Not an email address');
};

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
    const email = emailError(value.email);
    if (email) errors.email = email;
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

export const toCreateBody = (value: TStoryFormValue): TCreateStoryBody => ({
    name: value.name.trim(),
    author: value.author.trim(),
    password: value.password,
    description: value.description,
    public: value.public,
    mapSize: { width: Number(value.mapWidth), height: Number(value.mapHeight) },
    ...(value.email.trim() !== '' && { email: value.email.trim() }),
});

export const toUpdateBody = (value: TStoryFormValue, version: string): TUpdateStoryBody => ({
    version,
    name: value.name.trim(),
    author: value.author.trim(),
    email: value.email.trim(),
    description: value.description,
    public: value.public,
    ...(value.password !== '' && { password: value.password }),
});
