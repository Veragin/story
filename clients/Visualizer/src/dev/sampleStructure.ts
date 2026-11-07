import type { TStructureDto } from '@story/protocol';
import { staticStructureContext, type IStructureContext } from '../structure/structureContext';

export const STRUCTURE: TStructureDto = {
    version: 'v1',
    literals: [
        {
            name: 'TItemType',
            scope: 'local',
            file: 'data/items/itemInfo.ts',
            version: 'v1',
            values: ['value', 'tool', 'food'],
        },
        {
            name: 'TMood',
            scope: 'global',
            file: 'types/literals.ts',
            version: 'v1',
            values: ['calm', 'angry'],
        },
    ],
    types: [
        {
            name: 'Race',
            kind: 'class',
            origin: 'story',
            file: 'types/Race.ts',
            version: 'v1',
            fields: [{ key: 'name', type: { t: 'string' }, optional: false }],
            catalog: {
                name: 'races',
                file: 'data/catalogs/races.ts',
                idType: 'TRaceId',
            },
        },
        {
            name: 'TStats',
            kind: 'type',
            origin: 'story',
            file: 'types/TStats.ts',
            version: 'v1',
            fields: [
                { key: 'strength', type: { t: 'number' }, optional: false },
                { key: 'title', type: { t: 'string' }, optional: true },
            ],
        },
    ],
};

export const OPTIONS = {
    Location: [
        { id: 'forest', label: 'Forest' },
        { id: 'village', label: 'Village' },
    ],
    TItem: [{ id: 'axe', label: 'Axe' }, { id: 'bow' }],
    Race: [{ id: 'elf', label: 'Elf' }],
};

export const sampleStructure = (addLiteralValue?: IStructureContext['addLiteralValue']) =>
    staticStructureContext(STRUCTURE, OPTIONS, addLiteralValue);
