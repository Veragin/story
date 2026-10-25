import { GIT_DEFAULT_BRANCH, GIT_LIMITS, type TSetupGitBody } from '@story/protocol';
import { remoteUrlErrorMessage } from '@story/ui';

export type TGitConnectValue = { remoteUrl: string; token: string };

export type TGitConnectErrors = Partial<Record<keyof TGitConnectValue, string>>;

export const EMPTY_GIT_CONNECT: TGitConnectValue = { remoteUrl: '', token: '' };

export const validateGitConnect = (value: TGitConnectValue): TGitConnectErrors => {
    const remoteUrl = value.remoteUrl.trim();
    if (remoteUrl === '') {
        return value.token === '' ? {} : { remoteUrl: _('The token needs a repository URL') };
    }
    if (remoteUrl.length > GIT_LIMITS.remoteUrlMaxLength) {
        return { remoteUrl: _('At most %d characters', GIT_LIMITS.remoteUrlMaxLength) };
    }
    const urlError = remoteUrlErrorMessage(remoteUrl);
    return urlError ? { remoteUrl: urlError } : {};
};

export const hasGitConnectErrors = (errors: TGitConnectErrors) => Object.keys(errors).length > 0;

export const toGitSetup = (value: TGitConnectValue): TSetupGitBody | null => {
    const remoteUrl = value.remoteUrl.trim();
    if (remoteUrl === '') return null;
    return {
        remoteUrl,
        branch: GIT_DEFAULT_BRANCH,
        initial: 'push',
        ...(value.token !== '' && { token: value.token }),
    };
};
