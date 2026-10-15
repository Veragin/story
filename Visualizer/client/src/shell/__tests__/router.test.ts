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
        ['#/_canvas', { page: 'canvas' }],
    ];

    it.each(cases)('parses %s and round-trips it', (hash, route) => {
        expect(parseHash(hash)).toEqual(route);
        expect(routeToHash(route)).toBe(hash);
    });

    it('tolerates a missing # and trailing slashes', () => {
        expect(parseHash('/timeline/')).toEqual({ page: 'timeline' });
    });

    it.each(['', '#', '#/', '#/nope', '#/map/extra', '#/timeline/chapter', '#/entities/dragons'])(
        'returns null for %j',
        (hash) => {
            expect(parseHash(hash)).toBeNull();
        }
    );
});
