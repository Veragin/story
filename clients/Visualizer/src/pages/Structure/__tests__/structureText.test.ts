import '@story/shared';
import { describe, expect, it } from 'vitest';
import type { TStructTypeDto } from '@story/protocol';
import { catalogNameOf, touchedSummary, usagesOf } from '../structureText';

describe('structureText', () => {
    it.each([
        ['Race', 'races'],
        ['City', 'cities'],
        ['Day', 'days'],
        ['Box', 'boxes'],
        ['SpellBranch', 'spellBranches'],
        ['Tiger', 'tigers'],
        ['TCity', 'cities'],
        ['', ''],
    ])('names the catalog of %s %s', (name, plural) => {
        expect(catalogNameOf(name)).toBe(plural);
    });

    it('summarises touched files by folder', () => {
        expect(touchedSummary([])).toBeNull();
        expect(
            touchedSummary([
                'data/characters/thomas.ts',
                'data/characters/annie.ts',
                'data/npcs/Franta.ts',
                'data/catalogs/races.ts',
                'types/Race.ts',
            ])
        ).toBe('Updated 2 characters, 1 NPC, 1 catalog, 1 file');
    });

    it('lists the fields that use a literal or a referenced type', () => {
        const type = (name: string, fields: TStructTypeDto['fields']): TStructTypeDto => ({
            name,
            fields,
            kind: 'type',
            origin: 'story',
            file: `types/${name}.ts`,
            version: '',
        });
        const types = [
            type('Character', [
                { key: 'race', type: { t: 'ref', name: 'Race' }, optional: true },
                { key: 'moods', type: { t: 'array', of: { t: 'literal', name: 'TMood' } }, optional: false },
            ]),
            type('Race', [{ key: 'mood', type: { t: 'literal', name: 'TMood' }, optional: false }]),
        ];
        expect(usagesOf(types, 'Race')).toEqual(['Character.race']);
        expect(usagesOf(types, 'TMood')).toEqual(['Character.moods', 'Race.mood']);
    });
});
