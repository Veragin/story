import { describe, expect, it } from 'vitest';
import { parseEnv } from '../src/config/env';

describe('mail env', () => {
    it('defaults: the dev landing page as PUBLIC_URL, no SMTP_URL, info@story.cz as MAIL_FROM', () => {
        expect(parseEnv({})).toMatchObject({
            PUBLIC_URL: 'http://localhost:8153',
            SMTP_URL: null,
            MAIL_FROM: 'info@story.cz',
        });
    });

    it('normalizes PUBLIC_URL like an origin and keeps SMTP_URL as text', () => {
        const env = parseEnv({ PUBLIC_URL: ' https://Story.example/ ', SMTP_URL: ' smtp://u:p@mail:587 ' });
        expect(env.PUBLIC_URL).toBe('https://story.example');
        expect(env.SMTP_URL).toBe('smtp://u:p@mail:587');
        expect(parseEnv({ SMTP_URL: '' }).SMTP_URL).toBeNull();
    });

    it('trims MAIL_FROM and falls back to the default when blank', () => {
        expect(parseEnv({ MAIL_FROM: ' me@story.example ' }).MAIL_FROM).toBe('me@story.example');
        expect(parseEnv({ MAIL_FROM: ' ' }).MAIL_FROM).toBe('info@story.cz');
    });
});

describe('AI env', () => {
    it('defaults to the launcher sidecar', () => {
        expect(parseEnv({})).toMatchObject({
            AI_SANDBOX: 'launcher',
            AI_LAUNCHER_URL: 'http://ai-launcher:8155',
            AI_LAUNCHER_KEY_FILE: '/secret/ai_launcher_key',
            AI_SESSIONS_DIR: '/app/ai-sessions',
            AI_AGENTS_CONFIG_FILE: '/secret/ai_agents.json',
            AI_IDLE_STOP_MS: 30_000,
            AI_MAX_TURN_MS: 300_000,
            AI_MESSAGES_PER_MINUTE: 20,
        });
    });

    it('reads the optional GEMINI_API_KEY of AI_SANDBOX=none', () => {
        expect(parseEnv({}).GEMINI_API_KEY).toBeNull();
        expect(parseEnv({ GEMINI_API_KEY: ' ' }).GEMINI_API_KEY).toBeNull();
        expect(parseEnv({ GEMINI_API_KEY: ' key ' }).GEMINI_API_KEY).toBe('key');
    });

    it('allows AI_SANDBOX=none only without COOKIE_SECURE', () => {
        expect(parseEnv({ AI_SANDBOX: 'none' }).AI_SANDBOX).toBe('none');
        expect(() => parseEnv({ AI_SANDBOX: 'none', COOKIE_SECURE: '1' })).toThrow(/AI_SANDBOX=none/);
        expect(() => parseEnv({ AI_SANDBOX: 'docker' })).toThrow();
    });

    it('keeps the deprecated AI_MODEL / AI_MAX_BUDGET_USD unset unless given', () => {
        for (const env of [parseEnv({}), parseEnv({ AI_MODEL: ' ', AI_MAX_BUDGET_USD: '' })]) {
            expect(env.AI_MODEL).toBeUndefined();
            expect(env.AI_MAX_BUDGET_USD).toBeUndefined();
        }
        expect(parseEnv({ AI_MODEL: 'claude-opus-5-5', AI_MAX_BUDGET_USD: '2' })).toMatchObject({
            AI_MODEL: 'claude-opus-5-5',
            AI_MAX_BUDGET_USD: 2,
        });
        expect(() => parseEnv({ AI_MAX_BUDGET_USD: '0' })).toThrow();
        expect(() => parseEnv({ AI_MAX_BUDGET_USD: 'five' })).toThrow();
    });
});
