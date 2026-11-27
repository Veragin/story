import { LoginLimiter } from '../../auth/LoginLimiter';
import { AI_RATE_WINDOW_MS } from '../aiMessageLimiter';
import type { TAiOptions } from '../aiOptions';

export const AI_IMAGE_LIMITER = Symbol('AI_IMAGE_LIMITER');

export const aiImageLimiter = ({ gemini }: TAiOptions) =>
    new LoginLimiter({ maxFailures: gemini.imagesPerMinute, windowMs: AI_RATE_WINDOW_MS });
