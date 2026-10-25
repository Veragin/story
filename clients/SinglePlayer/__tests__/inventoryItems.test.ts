import { describe, expect, it } from 'vitest';
import { groupItemsByType, itemDetails, itemType, typeLabel } from '../src/templates/Components/Inventory/inventoryItems';

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

describe('groupItemsByType', () => {
    it('orders known types first, then unknown ones, then untyped items; names sorted', () => {
        const groups = groupItemsByType([
            item('wood', { type: 'resource' }),
            item('stone'),
            item('rune', { type: 'magic' }),
            item('bow', { type: 'weapon' }),
            item('apple', { type: 'food' }),
            item('berries', { type: 'food' }),
        ]);

        expect(groups.map((g) => [g.type, g.items.map((i) => i.id)])).toEqual([
            ['weapon', ['bow']],
            ['food', ['apple', 'berries']],
            ['resource', ['wood']],
            ['magic', ['rune']],
            [undefined, ['stone']],
        ]);
    });

    it('is empty for an empty inventory', () => {
        expect(groupItemsByType([])).toEqual([]);
    });
});

describe('itemType / typeLabel', () => {
    it('reads a string type only', () => {
        expect(itemType(item('a', { type: 'food' }))).toBe('food');
        expect(itemType(item('a', { type: 3 }))).toBeUndefined();
        expect(typeLabel('food')).toBe('Food');
        expect(typeLabel(undefined)).toBe('Other');
    });
});
