import { describe, expect, it } from 'vitest';
import { GIT_LIMITS, isGitBranchName } from '../src';

describe('isGitBranchName', () => {
    it('accepts ordinary branch names', () => {
        for (const name of ['main', 'feature/new-map', 'release-1.2', 'fix_42', 'a.b/c', 'jméno']) {
            expect([name, isGitBranchName(name)]).toEqual([name, true]);
        }
    });

    it('rejects what git check-ref-format --branch rejects', () => {
        const invalid = [
            '',
            '-main',
            '.hidden',
            '/main',
            'main/',
            'main.',
            'a..b',
            'a//b',
            'a/.b',
            'main.lock',
            'a.lock/b',
            '@',
            'a@{b',
            'has space',
            'a~1',
            'a^b',
            'a:b',
            'a?b',
            'a*b',
            'a[b',
            'a\\b',
            'a\u0007b',
            'x'.repeat(GIT_LIMITS.branchMaxLength + 1),
        ];
        for (const name of invalid) expect([name, isGitBranchName(name)]).toEqual([name, false]);
    });

    it('rejects non-strings', () => {
        expect(isGitBranchName(42)).toBe(false);
        expect(isGitBranchName(null)).toBe(false);
    });
});
