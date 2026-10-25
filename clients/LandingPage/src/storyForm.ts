import {
    GIT_DEFAULT_BRANCH,
    GIT_LIMITS,
    STORY_LIMITS,
    type TCreateStoryBody,
    type TGitConfigDto,
    type TSetupGitBody,
    type TStoryDto,
    type TUpdateGitConfigBody,
    type TUpdateStoryBody,
} from '@story/protocol';
import { remoteUrlErrorMessage } from '@story/ui';

export type TStoryFormMode = 'create' | 'edit';

export type TStoryFormValue = {
    name: string;
    author: string;
    password: string;
    passwordConfirm: string;
    description: string;
    mapWidth: string;
    mapHeight: string;
    public: boolean;
    gitRemoteUrl: string;
    gitToken: string;
};

/** `null` when the server has no git; `config` is `null` until the story is connected. */
export type TStoryGitState = { config: TGitConfigDto | null } | null;

export type TGitChange = { kind: 'setup'; body: TSetupGitBody } | { kind: 'update'; body: TUpdateGitConfigBody };

export type TStoryFormErrors = Partial<Record<keyof TStoryFormValue, string>>;

export const EMPTY_STORY_FORM: TStoryFormValue = {
    name: '',
    author: '',
    password: '',
    passwordConfirm: '',
    description: '',
    mapWidth: '40',
    mapHeight: '30',
    public: false,
    gitRemoteUrl: '',
    gitToken: '',
};

export const storyFormOf = (story: TStoryDto, git: TStoryGitState): TStoryFormValue => ({
    name: story.name,
    author: story.author,
    password: '',
    passwordConfirm: '',
    description: story.description,
    mapWidth: String(story.mapSize.width),
    mapHeight: String(story.mapSize.height),
    public: story.public,
    gitRemoteUrl: git?.config?.remoteUrl ?? '',
    gitToken: '',
});

const L = STORY_LIMITS;

const mapSideError = (text: string) => {
    const n = Number(text.trim());
    if (text.trim() === '' || !Number.isInteger(n) || n < L.mapSizeMin || n > L.mapSizeMax) {
        return _('A whole number from %d to %d', L.mapSizeMin, L.mapSizeMax);
    }
    return undefined;
};

const gitErrors = (value: TStoryFormValue, git: TStoryGitState): TStoryFormErrors => {
    if (!git) return {};
    const remoteUrl = value.gitRemoteUrl.trim();
    if (remoteUrl === '') {
        if (git.config) return { gitRemoteUrl: _('Disconnect in the git settings of the editor') };
        return value.gitToken === '' ? {} : { gitRemoteUrl: _('The token needs a repository URL') };
    }
    if (remoteUrl.length > GIT_LIMITS.remoteUrlMaxLength) {
        return { gitRemoteUrl: _('At most %d characters', GIT_LIMITS.remoteUrlMaxLength) };
    }
    const urlError = remoteUrlErrorMessage(remoteUrl);
    return urlError ? { gitRemoteUrl: urlError } : {};
};

export const validateStoryForm = (
    value: TStoryFormValue,
    { passwordRequired, git = null }: { passwordRequired: boolean; git?: TStoryGitState }
): TStoryFormErrors => {
    const errors: TStoryFormErrors = gitErrors(value, git);
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

export const toCreateBody = (value: TStoryFormValue): TCreateStoryBody => ({
    name: value.name.trim(),
    author: value.author.trim(),
    password: value.password,
    description: value.description,
    public: value.public,
    mapSize: { width: Number(value.mapWidth), height: Number(value.mapHeight) },
});

export const toUpdateBody = (value: TStoryFormValue, version: string): TUpdateStoryBody => ({
    version,
    name: value.name.trim(),
    author: value.author.trim(),
    description: value.description,
    public: value.public,
    ...(value.password !== '' && { password: value.password }),
});

// the token is sent only when typed: empty keeps the stored one
export const toGitChange = (value: TStoryFormValue, git: TStoryGitState): TGitChange | null => {
    const remoteUrl = value.gitRemoteUrl.trim();
    const token = value.gitToken === '' ? {} : { token: value.gitToken };
    if (!git || remoteUrl === '') return null;
    if (!git.config) {
        return { kind: 'setup', body: { remoteUrl, branch: GIT_DEFAULT_BRANCH, initial: 'push', ...token } };
    }
    if (remoteUrl === git.config.remoteUrl && value.gitToken === '') return null;
    return {
        kind: 'update',
        body: {
            version: git.config.version,
            ...(remoteUrl !== git.config.remoteUrl && { remoteUrl }),
            ...token,
        },
    };
};
