import path from 'node:path';
import { z } from 'zod';
import { DEFAULT_AGENTS_CONFIG_FILE, readAgentsConfig, type TAgentsConfig } from './agentsConfig';

export type TSandboxDriverName = 'docker-run' | 'docker-sandbox';

export type TStoriesMount = { kind: 'volume'; volume: string } | { kind: 'bind'; hostDir: string };

export type TLauncherOptions = {
    tokenFile: string;
    geminiTokenFile: string;
    keyFile: string;
    port: number;
    driver: TSandboxDriverName;
    image: string;
    stories: TStoriesMount;
    repoHostDir: string | null;
    sessionsVolume: string;
    network: string;
    instance: string;
    agents: TAgentsConfig;
};

export const DEFAULT_LAUNCHER_PORT = 8155;

const DOCKER_NAME = /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/;
const IMAGE_REFERENCE = /^[a-z0-9][a-z0-9_.\-/:@]*$/;

const optionalText = z.string().trim().optional();

const text = (fallback: string) => optionalText.transform((value) => value || fallback);

const dockerName = (fallback: string) => text(fallback).pipe(z.string().regex(DOCKER_NAME));

// `--mount` splits on commas, so a host path with one would inject mount options
const hostDir = optionalText
    .transform((value) => value || null)
    .refine(
        (value) => value === null || (path.isAbsolute(value) && !value.includes(',')),
        'must be an absolute path without commas'
    )
    .transform((value) => (value === null ? null : value.replace(/\/+$/, '') || '/'));

const LAUNCHER_ENV_SCHEMA = z.object({
    AI_TOKEN_FILE: text('/secret/ai_token'),
    AI_GEMINI_TOKEN_FILE: text('/secret/gemini_token'),
    AI_LAUNCHER_KEY_FILE: text('/secret/ai_launcher_key'),
    AI_LAUNCHER_PORT: z.coerce.number().int().min(1).max(65535).default(DEFAULT_LAUNCHER_PORT),
    AI_SANDBOX_DRIVER: z.enum(['docker-run', 'docker-sandbox']).default('docker-run'),
    AI_IMAGE: text('story-ai:latest').pipe(z.string().regex(IMAGE_REFERENCE)),
    AI_STORIES_VOLUME: optionalText.transform((value) => value || null).pipe(z.string().regex(DOCKER_NAME).nullable()),
    AI_STORIES_HOST_DIR: hostDir,
    AI_REPO_HOST_DIR: hostDir,
    AI_SESSIONS_VOLUME: dockerName('story-ai-sessions'),
    AI_NETWORK: dockerName('story-ai'),
    AI_INSTANCE: dockerName('prod'),
    AI_AGENTS_CONFIG_FILE: text(DEFAULT_AGENTS_CONFIG_FILE),
    AI_MODELS: optionalText.transform((value) =>
        value
            ? value
                  .split(',')
                  .map((model) => model.trim())
                  .filter(Boolean)
            : undefined
    ),
    AI_MAX_BUDGET_USD: optionalText
        .transform((value) => (value ? Number(value) : undefined))
        .pipe(z.number().positive().finite().optional()),
});

const storiesMount = (volume: string | null, hostDirectory: string | null): TStoriesMount => {
    if (volume && hostDirectory)
        throw new Error('Set only one of AI_STORIES_VOLUME (prod) and AI_STORIES_HOST_DIR (dev)');
    if (volume) return { kind: 'volume', volume };
    if (hostDirectory) return { kind: 'bind', hostDir: hostDirectory };
    throw new Error('Set AI_STORIES_VOLUME (prod) or AI_STORIES_HOST_DIR (dev)');
};

export const launcherOptionsFromEnv = (
    env: NodeJS.ProcessEnv,
    log: (message: string) => void = () => {}
): TLauncherOptions => {
    const parsed = LAUNCHER_ENV_SCHEMA.safeParse(env);
    if (!parsed.success) throw new Error(`Invalid launcher environment: ${z.prettifyError(parsed.error)}`);
    const values = parsed.data;
    return {
        tokenFile: values.AI_TOKEN_FILE,
        geminiTokenFile: values.AI_GEMINI_TOKEN_FILE,
        keyFile: values.AI_LAUNCHER_KEY_FILE,
        port: values.AI_LAUNCHER_PORT,
        driver: values.AI_SANDBOX_DRIVER,
        image: values.AI_IMAGE,
        stories: storiesMount(values.AI_STORIES_VOLUME, values.AI_STORIES_HOST_DIR),
        repoHostDir: values.AI_REPO_HOST_DIR,
        sessionsVolume: values.AI_SESSIONS_VOLUME,
        network: values.AI_NETWORK,
        instance: values.AI_INSTANCE,
        agents: readAgentsConfig(
            values.AI_AGENTS_CONFIG_FILE,
            { AI_MODELS: values.AI_MODELS, AI_MAX_BUDGET_USD: values.AI_MAX_BUDGET_USD },
            log
        ),
    };
};
