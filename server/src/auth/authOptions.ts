import type { ConfigService } from '@nestjs/config';
import type { TEnv } from '../config/env';
import { DEFAULT_ALLOWED_ORIGINS } from './csrf';

export const GRANT_TTL_MS = 24 * 60 * 60_000;

export const AUTH_OPTIONS = Symbol('AUTH_OPTIONS');

export type TAuthOptions = {
    grantTtlMs: number;
    cookieSecure: boolean;
    trustProxy: boolean;
    allowedOrigins: readonly string[];
};

export const authOptionsFromConfig = (config: ConfigService<TEnv, true>): TAuthOptions => {
    const allowedOrigins = config.get('ALLOWED_ORIGINS', { infer: true });
    return {
        grantTtlMs: GRANT_TTL_MS,
        cookieSecure: config.get('COOKIE_SECURE', { infer: true }),
        trustProxy: config.get('TRUST_PROXY', { infer: true }),
        allowedOrigins: allowedOrigins.length > 0 ? allowedOrigins : DEFAULT_ALLOWED_ORIGINS,
    };
};
