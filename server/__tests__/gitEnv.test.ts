import { describe, expect, it } from 'vitest';
import { parseEnv } from '../src/config/env';

const KEY = Buffer.alloc(32, 1).toString('base64');

describe('git env', () => {
    it('defaults: no key, no host limit, the example disabled, no file remotes', () => {
        expect(parseEnv({})).toMatchObject({
            GIT_TOKEN_KEY: null,
            GIT_ALLOWED_HOSTS: [],
            GIT_DISABLED_STORIES: ['example'],
            GIT_ALLOW_FILE_REMOTES: false,
        });
    });

    it('decodes a 32-byte base64 key and refuses anything else', () => {
        expect(parseEnv({ GIT_TOKEN_KEY: KEY }).GIT_TOKEN_KEY).toEqual(Buffer.alloc(32, 1));
        expect(() => parseEnv({ GIT_TOKEN_KEY: Buffer.alloc(16).toString('base64') })).toThrow(/GIT_TOKEN_KEY/);
        expect(() => parseEnv({ GIT_TOKEN_KEY: 'not base64!' })).toThrow(/GIT_TOKEN_KEY/);
    });

    it('parses the lists; an empty GIT_DISABLED_STORIES enables every story', () => {
        const env = parseEnv({ GIT_ALLOWED_HOSTS: ' GitHub.com, gitlab.com ,', GIT_DISABLED_STORIES: '' });
        expect(env.GIT_ALLOWED_HOSTS).toEqual(['github.com', 'gitlab.com']);
        expect(env.GIT_DISABLED_STORIES).toEqual([]);
    });
});
