import { describe, expect, it } from 'vitest';
import { nameAsText, withNameText } from '../locationName';

describe('locationName', () => {
    it('reads plain and translated names as text', () => {
        expect(nameAsText('Village')).toBe('Village');
        expect(nameAsText({ code: "_('Old mill')" })).toBe('Old mill');
        expect(nameAsText({ code: '_("It\'s here")' })).toBe("It's here");
    });

    it('refuses names computed by code', () => {
        expect(nameAsText({ code: 'prefix + "mill"' })).toBeUndefined();
        expect(nameAsText({ code: '_(name)' })).toBeUndefined();
    });

    it('keeps the translation wrapper when the name changes', () => {
        expect(withNameText('Village', 'Town')).toBe('Town');
        expect(withNameText({ code: "_('Old mill')" }, "Miller's")).toEqual({ code: "_('Miller\\'s')" });
    });
});
