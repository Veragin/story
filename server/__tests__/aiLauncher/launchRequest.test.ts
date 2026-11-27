import { describe, expect, it } from 'vitest';
import { parseLaunchRequest } from '../../aiLauncher/launchRequest';

const LIMITS = { models: ['claude-sonnet-5-5', 'claude-opus-5-5'], maxBudgetUsd: 5 };
const SESSION = '1b4e28ba-2fa1-11d2-883f-0016a7d3b4c1';

const parse = (body: unknown) => parseLaunchRequest(body, LIMITS);

describe('parseLaunchRequest', () => {
    it('accepts a minimal and a full request', () => {
        expect(parse({ storyId: 'demo', maxBudgetUsd: 1 })).toEqual({
            ok: true,
            request: { storyId: 'demo', maxBudgetUsd: 1 },
        });
        expect(
            parse({ storyId: 'demo-2', resumeSessionId: SESSION, model: 'claude-opus-5-5', maxBudgetUsd: 5 })
        ).toEqual({
            ok: true,
            request: { storyId: 'demo-2', resumeSessionId: SESSION, model: 'claude-opus-5-5', maxBudgetUsd: 5 },
        });
    });

    it.each([
        ['a non-object', 'demo'],
        ['null', null],
        ['a missing storyId', { maxBudgetUsd: 1 }],
        ['a path in storyId', { storyId: '../demo', maxBudgetUsd: 1 }],
        ['an upper-case storyId', { storyId: 'Demo', maxBudgetUsd: 1 }],
        ['a storyId with a comma', { storyId: 'a,b', maxBudgetUsd: 1 }],
        ['a missing budget', { storyId: 'demo' }],
        ['a zero budget', { storyId: 'demo', maxBudgetUsd: 0 }],
        ['a negative budget', { storyId: 'demo', maxBudgetUsd: -1 }],
        ['a budget over the cap', { storyId: 'demo', maxBudgetUsd: 5.01 }],
        ['a budget too small for the CLI', { storyId: 'demo', maxBudgetUsd: 1e-9 }],
        ['a string budget', { storyId: 'demo', maxBudgetUsd: '1' }],
        ['an unknown model', { storyId: 'demo', maxBudgetUsd: 1, model: 'gpt-4' }],
        ['a flag as model', { storyId: 'demo', maxBudgetUsd: 1, model: '--dangerously-skip-permissions' }],
        ['a non-UUID session', { storyId: 'demo', maxBudgetUsd: 1, resumeSessionId: '../../x' }],
        ['an unknown key', { storyId: 'demo', maxBudgetUsd: 1, image: 'alpine' }],
    ])('rejects %s', (_, body) => {
        const result = parse(body);
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.message).not.toBe('');
    });
});
