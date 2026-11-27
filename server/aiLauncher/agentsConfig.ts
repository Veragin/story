import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { isMissingFileError } from './secretFile';

export const DEFAULT_AGENTS_CONFIG_FILE = '/secret/ai_agents.json';

const MODEL_ID = /^[a-z0-9][a-z0-9.\-[\]]*$/i;

const modelId = z.string().regex(MODEL_ID);

const positiveInt = (fallback: number) => z.number().int().positive().default(fallback);

const pickDefault = (chosen: string | undefined, allowed: readonly string[], ctx: z.RefinementCtx, field: string) => {
    const picked = chosen ?? allowed[0];
    if (picked !== undefined && allowed.includes(picked)) return picked;
    ctx.addIssue({ code: 'custom', path: [field], message: `must be one of: ${allowed.join(', ')}` });
    return z.NEVER;
};

const CLAUDE_SCHEMA = z
    .strictObject({
        models: z.array(modelId).min(1).default(['claude-sonnet-5-5', 'claude-opus-5-5']),
        defaultModel: modelId.optional(),
        maxBudgetUsd: z.number().positive().finite().default(5),
    })
    .transform(({ defaultModel, ...claude }, ctx) => ({
        ...claude,
        defaultModel: pickDefault(defaultModel, claude.models, ctx, 'defaultModel'),
    }));

const IMAGE_MODEL_SCHEMA = z.strictObject({
    creditsPerImage: z.number().positive().finite().default(4),
    maxReferences: z.number().int().nonnegative().default(3),
});

const GEMINI_SCHEMA = z
    .strictObject({
        imageModels: z
            .record(modelId, IMAGE_MODEL_SCHEMA)
            .refine((models) => Object.keys(models).length > 0, 'must list at least one model')
            .default({ 'gemini-nano-banana-2.1': { creditsPerImage: 4, maxReferences: 3 } }),
        defaultImageModel: modelId.optional(),
        timeoutMs: positiveInt(120_000),
        maxConcurrent: positiveInt(4),
        maxPerStory: positiveInt(2),
        imagesPerMinute: positiveInt(6),
    })
    .transform(({ defaultImageModel, ...gemini }, ctx) => ({
        ...gemini,
        defaultImageModel: pickDefault(defaultImageModel, Object.keys(gemini.imageModels), ctx, 'defaultImageModel'),
    }));

export const AGENTS_CONFIG_SCHEMA = z.strictObject({
    claude: CLAUDE_SCHEMA.prefault({}),
    gemini: GEMINI_SCHEMA.prefault({}),
});

export type TAgentsConfig = z.infer<typeof AGENTS_CONFIG_SCHEMA>;
export type TClaudeConfig = TAgentsConfig['claude'];
export type TGeminiConfig = TAgentsConfig['gemini'];
export type TImageModelConfig = z.infer<typeof IMAGE_MODEL_SCHEMA>;

export const DEFAULT_AGENTS_CONFIG: TAgentsConfig = AGENTS_CONFIG_SCHEMA.parse({});

export type TClaudeEnvFallbacks = {
    AI_MODELS?: readonly string[];
    AI_MODEL?: string;
    AI_MAX_BUDGET_USD?: number;
};

const CLAUDE_ENV: readonly [keyof TClaudeEnvFallbacks, keyof TClaudeConfig][] = [
    ['AI_MODELS', 'models'],
    ['AI_MODEL', 'defaultModel'],
    ['AI_MAX_BUDGET_USD', 'maxBudgetUsd'],
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const readOptionalFile = (file: string) => {
    try {
        return readFileSync(file, 'utf8');
    } catch (e) {
        if (isMissingFileError(e)) return '';
        throw e;
    }
};

const readJsonFile = (file: string): unknown => {
    const text = readOptionalFile(file);
    if (!text.trim()) return {};
    try {
        return JSON.parse(text);
    } catch (e) {
        throw new Error(`Invalid ${file}: ${e instanceof Error ? e.message : String(e)}`);
    }
};

const claudeFallbacks = (env: TClaudeEnvFallbacks, file: string, log: (message: string) => void) => {
    const fallbacks: Record<string, unknown> = {};
    for (const [name, key] of CLAUDE_ENV) {
        const value = env[name];
        if (value === undefined) continue;
        log(`${name} is deprecated: set claude.${key} in ${file} instead (the file wins when both are set)`);
        fallbacks[key] = value;
    }
    return fallbacks;
};

const withClaudeFallbacks = (raw: unknown, fallbacks: Record<string, unknown>): unknown => {
    if (!isRecord(raw)) return raw;
    const claude = raw.claude ?? {};
    return isRecord(claude) ? { ...raw, claude: { ...fallbacks, ...claude } } : raw;
};

export const readAgentsConfig = (
    file: string,
    env: TClaudeEnvFallbacks = {},
    log: (message: string) => void = () => {}
): TAgentsConfig => {
    const raw = withClaudeFallbacks(readJsonFile(file), claudeFallbacks(env, file, log));
    const parsed = AGENTS_CONFIG_SCHEMA.safeParse(raw);
    if (!parsed.success) throw new Error(`Invalid ${file}:\n${z.prettifyError(parsed.error)}`);
    return parsed.data;
};
