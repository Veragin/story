// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getUiState, setUiState, UI_STATE_PREFIX } from '../../ui-state';

describe('ui-state', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        sessionStorage.clear();
    });

    it('round-trips JSON values', () => {
        setUiState('camera', { x: 1, zoom: 2 });
        expect(getUiState('camera', null)).toEqual({ x: 1, zoom: 2 });
    });

    it('keys every value by the story id', () => {
        expect(UI_STATE_PREFIX).toMatch(/^visualizer:[^:]*:$/);
        setUiState('camera', 1);
        expect(sessionStorage.getItem(`${UI_STATE_PREFIX}camera`)).toBe('1');
    });

    it('falls back on missing or invalid values', () => {
        expect(getUiState('missing', 5)).toBe(5);
        sessionStorage.setItem(`${UI_STATE_PREFIX}bad`, '{nope');
        expect(getUiState('bad', 'fallback')).toBe('fallback');
    });

    it('never throws when storage fails', () => {
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('quota');
        });
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('blocked');
        });
        expect(() => setUiState('x', 1)).not.toThrow();
        expect(getUiState('x', 7)).toBe(7);
    });
});
