import { GIT_LIMITS } from '@story/protocol';
import { HttpError } from '../common/HttpError';

export type TRemoteRules = { allowedHosts: readonly string[]; allowFileRemotes: boolean };

const CONTROL_OR_SPACE = /[\s\p{Cc}]/u;

const parseUrl = (value: string): URL | null => {
    try {
        return new URL(value);
    } catch {
        return null;
    }
};

export const validateRemoteUrl = (value: unknown, { allowedHosts, allowFileRemotes }: TRemoteRules): string => {
    const refuse = (why: string) => HttpError.badRequest(`Field "remoteUrl" ${why}`);
    if (typeof value !== 'string' || value === '') throw refuse('must be a non-empty string');
    if (value.length > GIT_LIMITS.remoteUrlMaxLength) {
        throw refuse(`is longer than ${GIT_LIMITS.remoteUrlMaxLength} characters`);
    }
    if (CONTROL_OR_SPACE.test(value)) throw refuse('must not contain whitespace');
    const url = parseUrl(value);
    if (url === null) throw refuse('is not a URL');
    if (url.protocol === 'file:' && allowFileRemotes) return value;
    if (url.protocol !== 'https:') throw refuse('must be an https:// URL');
    if (url.username !== '' || url.password !== '') {
        throw refuse('must not carry credentials: put the token in "token"');
    }
    const host = url.hostname.toLowerCase();
    if (allowedHosts.length > 0 && !allowedHosts.includes(host)) {
        throw refuse(`host "${host}" is not allowed (allowed: ${allowedHosts.join(', ')})`);
    }
    return value;
};
