import { describe, expect, it } from 'vitest';
import { buildCreateBody, diffEditable, displayName, itemSourceForType, validateEntityId } from '../entityFields';
import type { TEntityDto } from '@story/visualizer-protocol';

describe('entityFields', () => {
    it('validates ids', () => {
        expect(validateEntityId('thomas')).toBeNull();
        expect(validateEntityId('old_man2')).toBeNull();
        expect(validateEntityId('')).toBe('required');
        expect(validateEntityId('old-man')).toBe('dash');
        expect(validateEntityId('2cool')).toBe('identifier');
        expect(validateEntityId('a b')).toBe('identifier');
        expect(validateEntityId('Thomas')).toBe('identifier');
        expect(validateEntityId('_x')).toBe('identifier');
        expect(validateEntityId('x_1Y')).toBeNull();
        expect(validateEntityId('thomaS', ['thomas'])).toBe('exists');
    });

    it('places items by type', () => {
        expect(itemSourceForType('food')).toBe('foodInfo');
        expect(itemSourceForType('tool')).toBe('toolInfo');
        expect(itemSourceForType('weapon')).toBe('itemInfo');
        expect(itemSourceForType('gem')).toBe('itemInfo');
        expect(buildCreateBody('items', { id: 'apple', name: '', description: '', type: 'food' })).toEqual({
            id: 'apple',
            name: 'apple',
            type: 'food',
            source: 'foodInfo',
        });
    });

    it('reads a translated name', () => {
        expect(displayName({ code: "_('kingdom')" }, 'x')).toBe('kingdom');
    });

    it('diffs only editable fields', () => {
        const a = { kind: 'npcs', id: 'x', version: '1', file: 'f', name: 'A', init: { a: 1, b: [1] } };
        const b = { ...a, version: '2', init: { b: [1], a: 1 } };
        expect(diffEditable(a as unknown as TEntityDto, b as unknown as TEntityDto)).toEqual({});
        const c = { ...a, name: 'B' };
        expect(diffEditable(a as unknown as TEntityDto, c as unknown as TEntityDto)).toEqual({ name: 'B' });
        const d = { ...a, mapId: 'global', userFields: { energy: 1, nickname: 'x' } };
        const e = { ...a, userFields: { energy: 2 } };
        expect(diffEditable(d as unknown as TEntityDto, e as unknown as TEntityDto)).toEqual({
            mapId: null,
            userFields: { energy: 2, nickname: null },
        });
    });
});
