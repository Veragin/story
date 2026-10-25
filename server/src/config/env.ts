import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

const DEFAULT_PORT = 8123;

const DEFAULT_PUBLIC_URL = 'http://localhost:8103';
const DEFAULT_MAIL_FROM = 'info@story.cz';

const optionalText = z.string().trim().optional();

const flag = optionalText.transform((value) => value === '1');

export const normalizeOrigin = (origin: string) => origin.trim().replace(/\/+$/, '').toLowerCase();

const originList = optionalText.transform((value) => (value ?? '').split(',').map(normalizeOrigin).filter(Boolean));

const port = z.coerce.number().int().min(1).max(65535);

const list = (fallback: readonly string[]) =>
    optionalText.transform((value) =>
        value === undefined
            ? [...fallback]
            : value
                  .split(',')
                  .map((item) => item.trim().toLowerCase())
                  .filter(Boolean)
    );

const GIT_TOKEN_KEY_BYTES = 32;

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

const gitTokenKey = optionalText
    .refine(
        (value) => !value || (BASE64.test(value) && Buffer.from(value, 'base64').length === GIT_TOKEN_KEY_BYTES),
        `must be ${GIT_TOKEN_KEY_BYTES} bytes in base64 (openssl rand -base64 ${GIT_TOKEN_KEY_BYTES})`
    )
    .transform((value) => (value ? Buffer.from(value, 'base64') : null));

export const ENV_SCHEMA = z.object({
    PORT: port.default(DEFAULT_PORT),
    STORIES_ROOT: optionalText.transform((value) => path.resolve(REPO_ROOT, value || 'stories')),
    SINGLE_PLAYER_STANDALONE_DIR: optionalText.transform((value) =>
        path.resolve(REPO_ROOT, value || 'clients/SinglePlayer/dist-standalone')
    ),
    DB_HOST: z.string().trim().min(1).default('mysql'),
    DB_PORT: port.default(3306),
    DB_USER: z.string().trim().min(1).default('story'),
    DB_PASSWORD: z.string().default('story'),
    DB_NAME: z.string().trim().min(1).default('story'),
    COOKIE_SECURE: flag,
    TRUST_PROXY: flag,
    ALLOWED_ORIGINS: originList,
    GIT_TOKEN_KEY: gitTokenKey,
    GIT_ALLOWED_HOSTS: list([]),
    GIT_DISABLED_STORIES: list(['example']),
    GIT_ALLOW_FILE_REMOTES: flag,
    PUBLIC_URL: optionalText.transform((value) => normalizeOrigin(value || DEFAULT_PUBLIC_URL)),
    SMTP_URL: optionalText.transform((value) => value || null),
    MAIL_FROM: optionalText.transform((value) => value || DEFAULT_MAIL_FROM),
});

export type TEnv = z.infer<typeof ENV_SCHEMA>;

export const parseEnv = (raw: Record<string, unknown>): TEnv => {
    const result = ENV_SCHEMA.safeParse(raw);
    if (!result.success) {
        throw new Error(`Invalid environment:\n${z.prettifyError(result.error)}`);
    }
    return result.data;
};
