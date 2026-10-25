import { describe, expect, it } from 'vitest';
import { parseEnv } from '../src/config/env';
import { parseTestEnv, TEST_MAIL_FROM } from './helpers/env';

describe('mail env', () => {
    it('defaults: the dev landing page as PUBLIC_URL, no SMTP_URL', () => {
        expect(parseTestEnv()).toMatchObject({
            PUBLIC_URL: 'http://localhost:8103',
            SMTP_URL: null,
            MAIL_FROM: TEST_MAIL_FROM,
        });
    });

    it('normalizes PUBLIC_URL like an origin and keeps SMTP_URL as text', () => {
        const env = parseTestEnv({ PUBLIC_URL: ' https://Story.example/ ', SMTP_URL: ' smtp://u:p@mail:587 ' });
        expect(env.PUBLIC_URL).toBe('https://story.example');
        expect(env.SMTP_URL).toBe('smtp://u:p@mail:587');
        expect(parseTestEnv({ SMTP_URL: '' }).SMTP_URL).toBeNull();
    });

    it('requires MAIL_FROM', () => {
        expect(() => parseEnv({})).toThrow(/MAIL_FROM/);
        expect(() => parseEnv({ MAIL_FROM: ' ' })).toThrow(/MAIL_FROM/);
        expect(parseEnv({ MAIL_FROM: ' info@story.cz ' }).MAIL_FROM).toBe('info@story.cz');
    });
});
