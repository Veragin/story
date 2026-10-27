import { describe, expect, it } from 'vitest';
import { createColorId, isPaletteNameTaken } from '../palette';

const PALETTE = {
    none: { name: 'None', color: '#000000' },
    deep_water: { name: 'Deep water', color: '#0000ff' },
};

describe('palette', () => {
    it('derives a unique id from the name', () => {
        expect(createColorId(PALETTE, 'Ice')).toBe('ice');
        expect(createColorId(PALETTE, ' Deep  Water! ')).toBe('deep_water_2');
        expect(createColorId(PALETTE, 'Žžž')).toBe('tile');
    });

    it('detects taken names case-insensitively, ignoring the edited entry', () => {
        expect(isPaletteNameTaken(PALETTE, ' deep WATER ')).toBe(true);
        expect(isPaletteNameTaken(PALETTE, 'Deep water', 'deep_water')).toBe(false);
        expect(isPaletteNameTaken(PALETTE, 'Ice')).toBe(false);
    });
});
