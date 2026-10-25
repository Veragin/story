import { describe, expect, it } from 'vitest';
import { parseEnv } from '../src/config/env';

describe('mail env', () => {
    it('defaults: the dev landing page as PUBLIC_URL, no SMTP_URL, info@story.cz as MAIL_FROM', () => {
        expect(parseEnv({})).toMatchObject({
            PUBLIC_URL: 'http://localhost:8103',
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
