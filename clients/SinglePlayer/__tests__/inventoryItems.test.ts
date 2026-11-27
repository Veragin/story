import { describe, expect, it } from 'vitest';
import { countByType, itemDetails, itemType, itemTypes, sortItems, typeLabel } from '../src/templates/Components/Inventory/inventoryItems';

const item = (id: string, extra: Record<string, unknown> = {}) => ({ id, name: id, amount: 1, ...extra });

describe('itemDetails', () => {
    it('lists the extra info, humanized, without the base fields', () => {
        expect(itemDetails(item('bow', { type: 'weapon', damage: 10, hungerValue: 5 })).map((d) => d.label)).toEqual([
            'Damage: 10',
            'Hunger value: 5',
        ]);
    });

    it('skips nested and empty values, shows a true flag by name only', () => {
        const details = itemDetails(item('x', { asd: { time: false }, note: '', magic: true, cursed: false }));
        expect(details.map((d) => d.label)).toEqual(['Magic']);
    });
});

describe('sortItems', () => {
    it('orders known types first, then unknown ones, then untyped items; names sorted within a type', () => {
        const sorted = sortItems([
            item('wood', { type: 'resource' }),
            item('stone'),
            item('rune', { type: 'magic' }),
            item('bow', { type: 'weapon' }),
            item('berries', { type: 'food' }),
            item('apple', { type: 'food' }),
        ]);

        expect(sorted.map((i) => i.id)).toEqual(['bow', 'apple', 'berries', 'wood', 'rune', 'stone']);
    });
});

describe('itemTypes', () => {
    it('lists every type of the story and the inventory once, in display order', () => {
        const types = itemTypes(
            [{ name: 'Gold', type: 'value' }, { name: 'Bow', type: 'weapon' }],
            [item('stone'), item('rune', { type: 'magic' }), item('bow', { type: 'weapon' })]
        );

        expect(types).toEqual(['weapon', 'value', 'magic', undefined]);
    });

    it('is empty without items and item info', () => {
        expect(itemTypes([], [])).toEqual([]);
    });
});

describe('countByType', () => {
    it('counts the distinct items of a type', () => {
        const items = [item('apple', { type: 'food' }), item('berries', { type: 'food' }), item('stone')];
        expect(countByType(items, 'food')).toBe(2);
        expect(countByType(items, undefined)).toBe(1);
        expect(countByType(items, 'weapon')).toBe(0);
    });
});

describe('itemType / typeLabel', () => {
    it('reads a string type only', () => {
        expect(itemType(item('a', { type: 'food' }))).toBe('food');
        expect(itemType(item('a', { type: 3 }))).toBeUndefined();
        expect(itemType(item('a', { type: '' }))).toBeUndefined();
        expect(typeLabel('food')).toBe('Food');
        expect(typeLabel(undefined)).toBe('Other');
    });
});
