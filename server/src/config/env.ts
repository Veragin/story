import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

const DEFAULT_PORT = 8125;

const optionalText = z.string().trim().optional();

const flag = optionalText.transform((value) => value === '1');

const originList = optionalText.transform((value) =>
    (value ?? '')
        .split(',')
        .map((origin) => origin.trim().replace(/\/+$/, '').toLowerCase())
        .filter(Boolean)
);

const port = z.coerce.number().int().min(1).max(65535);

export const ENV_SCHEMA = z.object({
    PORT: port.default(DEFAULT_PORT),
    STORIES_ROOT: optionalText.transform((value) => path.resolve(REPO_ROOT, value || 'stories')),
    DB_HOST: z.string().trim().min(1).default('mysql'),
    DB_PORT: port.default(3306),
    DB_USER: z.string().trim().min(1).default('story'),
    DB_PASSWORD: z.string().default('story'),
    DB_NAME: z.string().trim().min(1).default('story'),
    COOKIE_SECURE: flag,
    TRUST_PROXY: flag,
    ALLOWED_ORIGINS: originList,
});

export type TEnv = z.infer<typeof ENV_SCHEMA>;

export const parseEnv = (raw: Record<string, unknown>): TEnv => {
    const result = ENV_SCHEMA.safeParse(raw);
    if (!result.success) {
        throw new Error(`Invalid environment:\n${z.prettifyError(result.error)}`);
    }
    return result.data;
};
