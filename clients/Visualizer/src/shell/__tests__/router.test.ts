import { describe, expect, it } from 'vitest';
import { parseHash, routeToHash, TRoute } from '../router';

describe('router hash parsing', () => {
    const cases: [string, TRoute][] = [
        ['#/map', { page: 'map' }],
        ['#/timeline', { page: 'timeline' }],
        ['#/timeline/chapter/village', { page: 'chapter', chapterId: 'village' as never }],
        ['#/entities', { page: 'entities' }],
        ['#/entities/characters', { page: 'entities', kind: 'characters' }],
        ['#/entities/items/a%20b', { page: 'entities', kind: 'items', id: 'a b' }],
        ['#/entities/catalogs/races', { page: 'catalog', catalog: 'races' }],
        ['#/entities/catalogs/races/elf', { page: 'catalog', catalog: 'races', id: 'elf' }],
        ['#/structure', { page: 'structure' }],
        ['#/structure/types', { page: 'structure', section: 'types' }],
        ['#/structure/types/TRace', { page: 'structure', section: 'types', name: 'TRace' }],
        ['#/structure/literals/TItemType', { page: 'structure', section: 'literals', name: 'TItemType' }],
        ['#/_canvas', { page: 'canvas' }],
        ['#/_inputs', { page: 'inputs' }],
    ];

    it.each(cases)('parses %s and round-trips it', (hash, route) => {
        expect(parseHash(hash)).toEqual(route);
        expect(routeToHash(route)).toBe(hash);
    });

    it('tolerates a missing # and trailing slashes', () => {
        expect(parseHash('/timeline/')).toEqual({ page: 'timeline' });
    });

    it.each([
        '',
        '#',
        '#/',
        '#/nope',
        '#/map/extra',
        '#/timeline/chapter',
        '#/entities/dragons',
        '#/entities/catalogs',
        '#/entities/catalogs/races/elf/x',
        '#/structure/enums',
        '#/structure/types/TRace/x',
    ])('returns null for %j', (hash) => {
        expect(parseHash(hash)).toBeNull();
    });
});
