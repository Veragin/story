import {
    GIT_LIMITS,
    GIT_SETUP_MODES,
    isGitBranchName,
    type TGitCheckoutBody,
    type TDeleteGitBranchBody,
    type TGitCommitBody,
    type TGitSetupMode,
} from '@story/protocol';
import { flagField, rejectUnknownFields, textField } from '../common/fields';
import { HttpError } from '../common/HttpError';
import type { TStoryGitRecord } from '../database/repositories/StoryGitRepository';
import { validateRemoteUrl, type TRemoteRules } from './gitRemote';

const L = GIT_LIMITS;

const CONTROL = /\p{Cc}/u;
const IDENT_FORBIDDEN = /[<>\p{Cc}]/u;

export type TAuthorDefaults = { authorName: string; authorEmail: string };

// `undefined`: keep the stored token, `null`: no token
export type TTokenChange = string | null | undefined;

export type TSetupInput = Omit<TStoryGitRecord, 'tokenEncrypted'> & { token: string | null; initial: TGitSetupMode };

export type TConfigChange = Partial<Omit<TStoryGitRecord, 'tokenEncrypted'>> & { token: TTokenChange };

const SETUP_FIELDS = ['remoteUrl', 'branch', 'token', 'authorName', 'authorEmail', 'initial'];
const UPDATE_FIELDS = ['version', 'remoteUrl', 'branch', 'token', 'authorName', 'authorEmail'];
const DELETE_FIELDS = ['version', 'removeRepo'];
const COMMIT_FIELDS = ['message', 'push'];
const CHECKOUT_FIELDS = ['branch', 'create'];
const DELETE_BRANCH_FIELDS = ['branch', 'remote'];

export const branchField = (body: Record<string, unknown>, field = 'branch'): string => {
    const value = body[field];
    if (!isGitBranchName(value)) throw HttpError.badRequest(`Field "${field}" is not a valid branch name`);
    return value;
};

const identField = (body: Record<string, unknown>, field: string, max: number, fallback: string): string => {
    if (body[field] === undefined) return fallback;
    const value = textField(body, field, max);
    if (IDENT_FORBIDDEN.test(value))
        throw HttpError.badRequest(`Field "${field}" must not contain <, > or control characters`);
    return value === '' ? fallback : value;
};

const tokenField = (body: Record<string, unknown>): TTokenChange => {
    const value = body.token;
    if (value === undefined || value === null) return value;
    const token = textField(body, 'token', L.tokenMaxLength);
    if (CONTROL.test(token)) throw HttpError.badRequest('Field "token" must not contain control characters');
    return token === '' ? undefined : token;
};

const setupMode = (value: unknown): TGitSetupMode => {
    const mode = GIT_SETUP_MODES.find((m) => m === value);
    if (mode === undefined) throw HttpError.badRequest(`Field "initial" must be one of ${GIT_SETUP_MODES.join(', ')}`);
    return mode;
};

export const parseSetupBody = (
    body: Record<string, unknown>,
    rules: TRemoteRules,
    defaults: TAuthorDefaults
): TSetupInput => {
    rejectUnknownFields(body, SETUP_FIELDS);
    return {
        remoteUrl: validateRemoteUrl(body.remoteUrl, rules),
        branch: branchField(body),
        token: tokenField(body) ?? null,
        authorName: identField(body, 'authorName', L.authorNameMaxLength, defaults.authorName),
        authorEmail: identField(body, 'authorEmail', L.authorEmailMaxLength, defaults.authorEmail),
        initial: setupMode(body.initial),
    };
};

export const parseConfigChange = (
    body: Record<string, unknown>,
    rules: TRemoteRules,
    current: TStoryGitRecord
): TConfigChange => {
    rejectUnknownFields(body, UPDATE_FIELDS);
    return {
        ...(body.remoteUrl !== undefined && { remoteUrl: validateRemoteUrl(body.remoteUrl, rules) }),
        ...(body.branch !== undefined && { branch: branchField(body) }),
        authorName: identField(body, 'authorName', L.authorNameMaxLength, current.authorName),
        authorEmail: identField(body, 'authorEmail', L.authorEmailMaxLength, current.authorEmail),
        token: tokenField(body),
    };
};

export const parseDeleteBody = (body: Record<string, unknown>): { removeRepo: boolean } => {
    rejectUnknownFields(body, DELETE_FIELDS);
    return { removeRepo: flagField(body, 'removeRepo') };
};

export const parseCommitBody = (body: Record<string, unknown>): TGitCommitBody => {
    rejectUnknownFields(body, COMMIT_FIELDS);
    const message = textField(body, 'message', L.messageMaxLength, { required: true, trim: false });
    if (message.trim().length < L.messageMinLength) throw HttpError.badRequest('Field "message" must not be empty');
    return { message, push: flagField(body, 'push') };
};

export const parseCheckoutBody = (body: Record<string, unknown>): TGitCheckoutBody => {
    rejectUnknownFields(body, CHECKOUT_FIELDS);
    return { branch: branchField(body), create: flagField(body, 'create') };
};

export const parseDeleteBranchBody = (body: Record<string, unknown>): TDeleteGitBranchBody => {
    rejectUnknownFields(body, DELETE_BRANCH_FIELDS);
    return { branch: branchField(body), remote: flagField(body, 'remote') };
};
