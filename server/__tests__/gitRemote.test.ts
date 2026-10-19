import { describe, expect, it } from 'vitest';
import { validateRemoteUrl, type TRemoteRules } from '../src/git/gitRemote';

const OPEN: TRemoteRules = { allowedHosts: [], allowFileRemotes: false };

const reason = (url: unknown, rules: TRemoteRules = OPEN) => {
    try {
        validateRemoteUrl(url, rules);
        return null;
    } catch (e) {
        return e instanceof Error ? e.message : String(e);
    }
};

describe('validateRemoteUrl', () => {
    it('accepts https URLs', () => {
        expect(validateRemoteUrl('https://github.com/me/story.git', OPEN)).toBe('https://github.com/me/story.git');
    });

    it.each([
        ['http://github.com/me/x.git', 'https://'],
        ['ssh://git@github.com/me/x.git', 'https://'],
        ['git@github.com:me/x.git', 'URL'],
        ['file:///srv/x.git', 'https://'],
        ['ext::sh -c touch% /tmp/pwned', 'whitespace'],
        ['ext::sh', 'https://'],
        ['https://user:token@github.com/me/x.git', 'credentials'],
        ['https://token@github.com/me/x.git', 'credentials'],
        ['https://github.com/me/x.git\n', 'whitespace'],
        ['not a url', 'whitespace'],
        ['', 'non-empty'],
        [42, 'non-empty'],
        [`https://github.com/${'x'.repeat(2048)}`, 'longer'],
    ])('refuses case %#', (url, why) => {
        expect(reason(url)).toContain(why);
    });

    it('limits hosts when an allowlist is set', () => {
        const rules = { allowedHosts: ['github.com'], allowFileRemotes: false };
        expect(reason('https://GitHub.com/me/x.git', rules)).toBeNull();
        expect(reason('https://gitlab.com/me/x.git', rules)).toContain('not allowed');
        expect(reason('https://github.com.evil.io/x.git', rules)).toContain('not allowed');
    });

    it('takes file:// remotes only when allowed', () => {
        expect(reason('file:///srv/x.git', { allowedHosts: [], allowFileRemotes: true })).toBeNull();
    });
});
