import '@story/shared';
import { describe, expect, it } from 'vitest';
import type { TStructTypeDto } from '@story/visualizer-protocol';
import { catalogNameOf, touchedSummary, usagesOf } from '../structureText';

describe('structureText', () => {
    it.each([
        ['TRace', 'races'],
        ['TCity', 'cities'],
        ['TDay', 'days'],
        ['TBox', 'boxes'],
        ['TSpellBranch', 'spellBranches'],
        ['T', ''],
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
                'types/TRace.ts',
            ])
        ).toBe('Updated 2 characters, 1 NPC, 1 catalog, 1 file');
    });

    it('lists the fields that use a literal or a referenced type', () => {
        const type = (name: string, fields: TStructTypeDto['fields']): TStructTypeDto => ({
            name,
            fields,
            origin: 'story',
            file: `types/${name}.ts`,
            version: '',
        });
        const types = [
            type('TCharacter', [
                { key: 'race', type: { t: 'ref', name: 'TRace' }, optional: true },
                { key: 'moods', type: { t: 'array', of: { t: 'literal', name: 'TMood' } }, optional: false },
            ]),
            type('TRace', [{ key: 'mood', type: { t: 'literal', name: 'TMood' }, optional: false }]),
        ];
        expect(usagesOf(types, 'TRace')).toEqual(['TCharacter.race']);
        expect(usagesOf(types, 'TMood')).toEqual(['TCharacter.moods', 'TRace.mood']);
    });
});
