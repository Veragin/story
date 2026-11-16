import { describe, expect, it } from 'vitest';
import type { TStreamResult } from '../../src/ai/streamJson';
import { creditsOf, tokensDto, usageRecord, usdOfCredits } from '../../src/ai/usage';

const result = (costUsd: number, model: string | null = 'claude-opus-5-5'): TStreamResult => ({
    sessionId: 's',
    subtype: 'success',
    isError: false,
    costUsd,
    usage: { inputTokens: 1, outputTokens: 2, cacheReadTokens: 3, cacheCreationTokens: 4 },
    model,
});

describe('usage', () => {
    it('charges a cent per credit, rounded up, without float noise', () => {
        expect(creditsOf(0)).toBe(0);
        expect(creditsOf(0.07)).toBe(7);
        expect(creditsOf(0.0734512)).toBe(8);
        expect(creditsOf(0.0000004)).toBe(0);
        expect(creditsOf(0.000001)).toBe(1);
        expect(creditsOf(1.1)).toBe(110);
        expect(usdOfCredits(250)).toBe(2.5);
    });

    it('turns a result into a usage row', () => {
        expect(usageRecord(result(0.0734512), 'sess', 'claude-sonnet-5-5')).toEqual({
            sessionId: 'sess',
            model: 'claude-opus-5-5',
            inputTokens: 1,
            outputTokens: 2,
            cacheReadTokens: 3,
            cacheCreationTokens: 4,
            costMicroUsd: 73451,
            credits: 8,
        });
        expect(usageRecord(result(0, null), 'sess', 'claude-sonnet-5-5').model).toBe('claude-sonnet-5-5');
        expect(tokensDto(result(0).usage)).toEqual({ input: 1, output: 2, cacheRead: 3, cacheCreation: 4 });
    });
});
