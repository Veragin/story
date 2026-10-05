import type { TStructureDto } from '@story/visualizer-protocol';
import { staticStructureContext, type IStructureContext } from '../structureContext';

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
            name: 'TRace',
            origin: 'story',
            file: 'types/TRace.ts',
            version: 'v1',
            fields: [{ key: 'name', type: { t: 'string' }, optional: false }],
            catalog: {
                name: 'races',
                file: 'data/catalogs/races.ts',
                idType: 'TRaceId',
            },
        },
    ],
};

export const OPTIONS = {
    TLocation: [
        { id: 'forest', label: 'Forest' },
        { id: 'village', label: 'Village' },
    ],
    TItem: [{ id: 'axe', label: 'Axe' }, { id: 'bow' }],
    TRace: [{ id: 'elf', label: 'Elf' }],
};

export const sampleStructure = (addLiteralValue?: IStructureContext['addLiteralValue']) =>
    staticStructureContext(STRUCTURE, OPTIONS, addLiteralValue);
