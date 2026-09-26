import { describe, expect, it } from 'vitest';
import {
    buildCreateBody,
    diffEditable,
    displayName,
    itemSourceForType,
    itemTypesForSource,
    parseLiteral,
    validateEntityId,
    valueToSource,
} from '../entityFields';
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
        expect(itemTypesForSource('itemInfo')).toEqual(['value', 'resource', 'weapon']);
        expect(buildCreateBody('items', { id: 'apple', name: '', description: '', type: 'food' })).toEqual({
            id: 'apple',
            name: 'apple',
            type: 'food',
            source: 'foodInfo',
            props: { hungerValue: 0 },
        });
    });

    it('renders values as source and parses literals back', () => {
        expect(valueToSource({ asd: "it's", time: false })).toBe("{ asd: 'it\\'s', time: false }");
        expect(valueToSource([{ id: 'bow', amount: 1 }])).toBe("[{ id: 'bow', amount: 1 }]");
        expect(valueToSource({ code: 's.x > 1' })).toBe('s.x > 1');
        expect(valueToSource(undefined)).toBe('undefined');
        expect(parseLiteral("'Forest'")).toBe('Forest');
        expect(parseLiteral("'it\\'s'")).toBe("it's");
        expect(parseLiteral("'a' + 'b'")).toBeUndefined();
        expect(parseLiteral('10')).toBe(10);
        expect(parseLiteral('true')).toBe(true);
        expect(parseLiteral("_('kingdom')")).toBeUndefined();
        expect(displayName({ code: "_('kingdom')" }, 'x')).toBe('kingdom');
    });

    it('diffs only editable fields', () => {
        const a = { kind: 'npcs', id: 'x', version: '1', file: 'f', name: 'A', init: { a: 1, b: [1] } };
        const b = { ...a, version: '2', init: { b: [1], a: 1 } };
        expect(diffEditable(a as unknown as TEntityDto, b as unknown as TEntityDto)).toEqual({});
        const c = { ...a, name: 'B' };
        expect(diffEditable(a as unknown as TEntityDto, c as unknown as TEntityDto)).toEqual({ name: 'B' });
    });
});
