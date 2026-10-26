import { describe, expect, it } from 'vitest';
import {
    descendantLocationIds,
    locationIdFromName,
    locationIdPrefix,
    mapAncestors,
    mapIdOfLocation,
    parentLocationId,
} from '../locationTree';

const ids = new Set(['village', 'village_inn', 'village_inn_cellar', 'old_mill', 'kingdom']);

describe('locationTree', () => {
    it('finds the parent as the longest existing prefix', () => {
        expect(parentLocationId('village_inn_cellar', ids)).toBe('village_inn');
        expect(parentLocationId('village_inn', ids)).toBe('village');
        expect(parentLocationId('old_mill', ids)).toBeNull();
        expect(mapIdOfLocation('old_mill', ids)).toBe('global');
        expect(mapIdOfLocation('village_inn', ids)).toBe('village');
    });

    it('lists descendants deepest first', () => {
        expect(descendantLocationIds('village', ids)).toEqual(['village_inn_cellar', 'village_inn']);
        expect(descendantLocationIds('kingdom', ids)).toEqual([]);
    });

    it('builds the map chain and the id prefix', () => {
        expect(mapAncestors('village_inn', ids)).toEqual(['global', 'village', 'village_inn']);
        expect(mapAncestors('global', ids)).toEqual(['global']);
        expect(locationIdPrefix('village')).toBe('village_');
        expect(locationIdPrefix('global')).toBe('');
    });

    it('derives a camelCase id from a location name', () => {
        expect(locationIdFromName('Old Mill')).toBe('oldMill');
        expect(locationIdFromName('  the HQ-tower 2 ')).toBe('theHqTower2');
        expect(locationIdFromName('Žluťoučký kůň')).toBe('zlutouckyKun');
        expect(locationIdFromName('')).toBe('');
    });
});
