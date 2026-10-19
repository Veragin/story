import type { ConfigService } from '@nestjs/config';
import type { TEnv } from '../config/env';

export const GIT_OPTIONS = Symbol('GIT_OPTIONS');

export type TGitOptions = {
    tokenKey: Buffer | null;
    allowedHosts: readonly string[];
    disabledStories: readonly string[];
    allowFileRemotes: boolean;
};

export const gitOptionsFromConfig = (config: ConfigService<TEnv, true>): TGitOptions => ({
    tokenKey: config.get('GIT_TOKEN_KEY', { infer: true }),
    allowedHosts: config.get('GIT_ALLOWED_HOSTS', { infer: true }),
    disabledStories: config.get('GIT_DISABLED_STORIES', { infer: true }),
    allowFileRemotes: config.get('GIT_ALLOW_FILE_REMOTES', { infer: true }),
});
