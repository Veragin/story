import { setTimeout } from 'node:timers/promises';
import { PASSWORD_RESET_TOKEN_PARAM } from '@story/protocol';
import type { ConfigService } from '@nestjs/config';
import type { TEnv } from '../config/env';
import type { TMail } from '../mail/Mailer';
import { LoginLimiter } from './LoginLimiter';

export const RESET_TOKEN_TTL_MS = 12 * 60 * 60_000;

export const WRONG_EMAIL_DELAY_MS = 1_000;

const MAX_RESET_REQUESTS = 5;
const RESET_REQUEST_WINDOW_MS = 15 * 60_000;

export const RESET_REQUEST_LIMITER = Symbol('RESET_REQUEST_LIMITER');

export const resetRequestLimiter = () =>
    new LoginLimiter({ maxFailures: MAX_RESET_REQUESTS, windowMs: RESET_REQUEST_WINDOW_MS });

export const PASSWORD_RESET_OPTIONS = Symbol('PASSWORD_RESET_OPTIONS');

export type TPasswordResetOptions = {
    publicUrl: string;
    wrongEmailDelay: () => Promise<void>;
};

export const passwordResetOptionsFromConfig = (config: ConfigService<TEnv, true>): TPasswordResetOptions => ({
    publicUrl: config.get('PUBLIC_URL', { infer: true }),
    wrongEmailDelay: () => setTimeout(WRONG_EMAIL_DELAY_MS),
});

export const isStoryEmailMatch = (storyEmail: string, given: string) =>
    storyEmail !== '' && storyEmail.toLowerCase() === given.trim().toLowerCase();

export const resetLink = (publicUrl: string, storyId: string, token: string) =>
    `${publicUrl}/?${new URLSearchParams({ story: storyId, [PASSWORD_RESET_TOKEN_PARAM]: token })}`;

export const resetMail = (storyName: string, link: string): Omit<TMail, 'to'> => ({
    subject: `New password for the story "${storyName}"`,
    text:
        `Someone asked to set a new password for the story "${storyName}".\n\n` +
        `Open this link to set it (valid for 12 hours):\n${link}\n\n` +
        'If it was not you, ignore this mail; the password stays as it is.',
});
