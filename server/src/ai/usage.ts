import type { TAiTokensDto } from '@story/protocol';
import type { TAiUsageRecord } from '../database/repositories/AiCreditRepository';
import type { TStreamResult, TStreamUsage } from './streamJson';

// plan 0.5: one credit is a cent of `total_cost_usd`, rounded up
export const CREDITS_PER_USD = 100;

const MICRO = 1e6;

export const microUsdOf = (costUsd: number): number => Math.round(costUsd * MICRO);

export const creditsOf = (costUsd: number): number => Math.ceil((microUsdOf(costUsd) * CREDITS_PER_USD) / MICRO);

export const usdOfCredits = (credits: number): number => credits / CREDITS_PER_USD;

export const usageRecord = (result: TStreamResult, sessionId: string, fallbackModel: string): TAiUsageRecord => ({
    sessionId,
    model: result.model ?? fallbackModel,
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
    cacheReadTokens: result.usage.cacheReadTokens,
    cacheCreationTokens: result.usage.cacheCreationTokens,
    costMicroUsd: microUsdOf(result.costUsd),
    credits: creditsOf(result.costUsd),
});

export const tokensDto = (usage: TStreamUsage): TAiTokensDto => ({
    input: usage.inputTokens,
    output: usage.outputTokens,
    cacheRead: usage.cacheReadTokens,
    cacheCreation: usage.cacheCreationTokens,
});

export const addTokens = (a: TAiTokensDto, b: TAiTokensDto): TAiTokensDto => ({
    input: a.input + b.input,
    output: a.output + b.output,
    cacheRead: a.cacheRead + b.cacheRead,
    cacheCreation: a.cacheCreation + b.cacheCreation,
});

export const NO_TOKENS: TAiTokensDto = { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 };
