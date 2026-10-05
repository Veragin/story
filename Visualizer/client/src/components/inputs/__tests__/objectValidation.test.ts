import '@story/shared'; // installs the global `_`
import { describe, expect, it } from 'vitest';
import type { TFieldDesc } from '@story/visualizer-protocol';
import { issueText, validateObjectSource } from '../ObjectInput/objectValidation';

const FIELDS: TFieldDesc[] = [
    { key: 'health', type: { t: 'number' }, optional: false },
    { key: 'location', type: { t: 'ref', name: 'TLocation' }, optional: false },
    { key: 'mood', type: { t: 'literal', name: 'TMood' }, optional: true },
    {
        key: 'inventory',
        type: {
            t: 'array',
            of: { t: 'object', fields: [{ key: 'id', type: { t: 'ref', name: 'TItem' }, optional: false }] },
        },
        optional: true,
    },
];

const context = {
    literalValues: (name: string) => (name === 'TMood' ? ['calm', 'angry'] : []),
    idsOf: (name: string) => (name === 'TLocation' ? ['forest'] : name === 'TItem' ? ['axe'] : []),
};

const messages = (source: string, allowCustomFields = false) => {
    const { parse, issues } = validateObjectSource(source, { fields: FIELDS, allowCustomFields, context });
    return parse.ok ? issues.map(issueText) : [parse.error];
};

describe('objectValidation', () => {
    it('accepts a matching object', () => {
        expect(messages("{ health: 10, location: 'forest', mood: 'calm', inventory: [{ id: 'axe' }] }")).toEqual([]);
    });

    it('reports parse errors and non-objects', () => {
        expect(messages('{ health: 10')).toEqual(['Missing }']);
        expect(messages('[1]')).toEqual(['Not an object literal']);
        expect(messages('makeInit()')).toEqual(['Not an object literal']);
    });

    it('reports missing, unknown and mismatched fields', () => {
        expect(messages("{ health: 'lots', mood: 'sad', energy: 1 }")).toEqual([
            'location: Missing required field',
            'energy: Unknown field',
            'health: Expected a number',
            "mood: 'sad' is not in TMood",
        ]);
        expect(messages("{ health: 1, location: 'moon', inventory: [{ id: 'bow' }, 3] }")).toEqual([
            "location: Unknown TLocation id 'moon'",
            "inventory.0.id: Unknown TItem id 'bow'",
            'inventory.1: Expected an object',
        ]);
    });

    it('allows custom fields when asked', () => {
        expect(messages("{ health: 1, location: 'forest', energy: 1 }", true)).toEqual([]);
    });

    it('does not check nested code', () => {
        expect(messages("{ health: s.max(), location: pick(), mood: _('calm') }")).toEqual([]);
    });
});
