import { describe, expect, it } from 'vitest';
import { commonPrefix, findActiveToken, replaceToken } from '../aiToken';

describe('findActiveToken', () => {
    it('finds an @ token at the start of the draft or after whitespace', () => {
        expect(findActiveToken('@')).toEqual({ start: 0, trigger: '@', query: '' });
        expect(findActiveToken('see @character:th')).toEqual({ start: 4, trigger: '@', query: 'character:th' });
        expect(findActiveToken('one\n@np')).toEqual({ start: 4, trigger: '@', query: 'np' });
    });

    it('ignores an @ in the middle of a word', () => {
        expect(findActiveToken('a@b')).toBeNull();
    });

    it('gives no token when the draft ends with whitespace or is empty', () => {
        expect(findActiveToken('')).toBeNull();
        expect(findActiveToken('@character:thomas ')).toBeNull();
        expect(findActiveToken('/resume ')).toBeNull();
    });

    it('accepts a / token only as the whole draft so far', () => {
        expect(findActiveToken('/res')).toEqual({ start: 0, trigger: '/', query: 'res' });
        expect(findActiveToken('/resume 1')).toBeNull();
        expect(findActiveToken('hi /res')).toBeNull();
    });
});

describe('replaceToken', () => {
    it('replaces the trailing token', () => {
        const draft = 'see @cha';
        const token = findActiveToken(draft);
        expect(token).not.toBeNull();
        if (token) expect(replaceToken(draft, token, '@character:')).toBe('see @character:');
    });
});

describe('commonPrefix', () => {
    it('handles an empty list, one value and values without a shared prefix', () => {
        expect(commonPrefix([])).toBe('');
        expect(commonPrefix(['@passage:a-b'])).toBe('@passage:a-b');
        expect(commonPrefix(['/clear', '/cost'])).toBe('/c');
        expect(commonPrefix(['abc', 'xyz'])).toBe('');
        expect(commonPrefix(['@passage:village-thomas-intro', '@passage:village-thomas-forest'])).toBe(
            '@passage:village-thomas-'
        );
    });
});
