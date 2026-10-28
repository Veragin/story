import { describe, expect, it } from 'vitest';
import { withDescription } from '../withDescription';

describe('withDescription', () => {
    it('sets the description and keeps the other keys', () => {
        expect(withDescription({ code: 'x', description: 'old' }, 'new')).toEqual({
            code: 'x',
            description: 'new',
        });
    });

    it('drops the key when the description is cleared', () => {
        const next = withDescription({ code: 'x', description: 'old' }, '');
        expect(next).toEqual({ code: 'x' });
        expect('description' in next).toBe(false);
    });
});
