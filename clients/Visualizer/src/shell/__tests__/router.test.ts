import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_ROUTE, parseHash, Router, routeToHash, TRoute } from '../router';

describe('router hash parsing', () => {
    const cases: [string, TRoute][] = [
        ['#/map', { page: 'map' }],
        ['#/map/village', { page: 'map', mapId: 'village' }],
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
        ['#/engine', { page: 'engine' }],
        ['#/engine/onLinkClick', { page: 'engine', section: 'onLinkClick' }],
        ['#/engine/topbar', { page: 'engine', section: 'topbar' }],
        ['#/settings', { page: 'settings' }],
        ['#/settings/git', { page: 'settings', section: 'git' }],
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
        '#/map/village/extra',
        '#/timeline/chapter',
        '#/entities/dragons',
        '#/entities/catalogs',
        '#/entities/catalogs/races/elf/x',
        '#/structure/enums',
        '#/structure/types/TRace/x',
        '#/engine/statusBar',
        '#/engine/topbar/x',
        '#/settings/mail',
        '#/settings/git/x',
    ])('returns null for %j', (hash) => {
        expect(parseHash(hash)).toBeNull();
    });
});

describe('router leaving the settings', () => {
    let router: Router | null = null;

    afterEach(() => {
        router?.stop();
        router = null;
    });

    const start = (hash: string) => {
        window.history.replaceState(null, '', hash);
        const started = new Router();
        started.start();
        router = started;
        return started;
    };

    it('returns to the route before the settings', () => {
        const r = start('#/timeline');
        r.navigate({ page: 'settings' }, { replace: true });
        r.navigate({ page: 'settings', section: 'git' }, { replace: true });
        r.leaveSettings();
        expect(window.location.hash).toBe('#/timeline');
    });

    it('returns to the default route when the settings were opened first', () => {
        const r = start('#/settings/git');
        expect(r.route).toEqual({ page: 'settings', section: 'git' });
        r.leaveSettings();
        expect(window.location.hash).toBe(routeToHash(DEFAULT_ROUTE));
    });
});
