import { describe, expect, it } from 'vitest';
import { isBrightColor, readableTextColor, relativeLuminance } from '../color';

describe('color', () => {
    it('computes the relative luminance of a hex colour', () => {
        expect(relativeLuminance('#000000')).toBe(0);
        expect(relativeLuminance('#ffffff')).toBeCloseTo(1);
        expect(relativeLuminance('#ffffff80')).toBeCloseTo(1);
        expect(relativeLuminance('red')).toBeUndefined();
    });

    it('picks black text on bright colours and white on dark ones', () => {
        expect(isBrightColor('#ffeb3b')).toBe(true);
        expect(readableTextColor('#ffeb3b')).toBe('#000');
        expect(isBrightColor('#1565c0')).toBe(false);
        expect(readableTextColor('#1565c0')).toBe('#fff');
        expect(readableTextColor('not a colour')).toBe('#fff');
    });
});
