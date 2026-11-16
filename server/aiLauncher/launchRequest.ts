import { STORY_ID_PATTERN } from '@story/protocol';
import { z } from 'zod';

export type TLaunchRequest = {
    storyId: string;
    resumeSessionId?: string;
    model?: string;
    maxBudgetUsd: number;
};

export type TLaunchLimits = { models: readonly string[]; maxBudgetUsd: number };

export type TLaunchRequestResult = { ok: true; request: TLaunchRequest } | { ok: false; message: string };

const SESSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const formatUsd = (usd: number): string => usd.toFixed(6).replace(/\.?0+$/, '');

const launchRequestSchema = (limits: TLaunchLimits) =>
    z.strictObject({
        storyId: z.string().regex(STORY_ID_PATTERN),
        resumeSessionId: z.string().regex(SESSION_ID_PATTERN).optional(),
        model: z
            .string()
            .refine((model) => limits.models.includes(model), `must be one of ${limits.models.join(', ')}`)
            .optional(),
        maxBudgetUsd: z
            .number()
            .positive()
            .max(limits.maxBudgetUsd)
            .refine((usd) => formatUsd(usd) !== '0', 'is too small'),
    });

export const parseLaunchRequest = (body: unknown, limits: TLaunchLimits): TLaunchRequestResult => {
    const parsed = launchRequestSchema(limits).safeParse(body);
    return parsed.success ? { ok: true, request: parsed.data } : { ok: false, message: z.prettifyError(parsed.error) };
};
