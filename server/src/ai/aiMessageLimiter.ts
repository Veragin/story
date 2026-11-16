import { LoginLimiter } from '../auth/LoginLimiter';
import type { TAiOptions } from './aiOptions';

const AI_MESSAGE_WINDOW_MS = 60_000;

export const AI_MESSAGE_LIMITER = Symbol('AI_MESSAGE_LIMITER');

export const aiMessageLimiter = ({ messagesPerMinute }: TAiOptions) =>
    new LoginLimiter({ maxFailures: messagesPerMinute, windowMs: AI_MESSAGE_WINDOW_MS });
