import { describe, expect, it } from 'vitest';
import {
    GLOBAL_ROUTE_NAMES,
    GLOBAL_ROUTES,
    isRouteName,
    ROUTE_NAMES,
    routeDef,
    routeTemplate,
    STORY_ROUTE_NAMES,
    STORY_ROUTES,
    templateParams,
    type TRouteAccess,
} from '../src';

const PUBLIC_ROUTES = [
    'health',
    'listStories',
    'createStory',
    'importStory',
    'login',
    'logout',
    'getSession',
    'getStoryAccess',
];

const ACCESS_LEVELS: readonly TRouteAccess[] = ['public', 'read', 'write'];

describe('route access levels (D3)', () => {
    it('gives every route a valid access level', () => {
        for (const route of ROUTE_NAMES) expect(ACCESS_LEVELS).toContain(routeDef(route).access);
    });

    it('makes exactly the global routes public', () => {
        const publicRoutes = ROUTE_NAMES.filter((route) => routeDef(route).access === 'public');
        expect(new Set(publicRoutes)).toEqual(new Set(PUBLIC_ROUTES));
        expect(new Set(GLOBAL_ROUTE_NAMES)).toEqual(new Set(PUBLIC_ROUTES));
    });

    it('needs read access for story GETs and write access for story mutations', () => {
        for (const route of STORY_ROUTE_NAMES) {
            const { method, access } = STORY_ROUTES[route];
            expect([route, access]).toEqual([route, method === 'GET' ? 'read' : 'write']);
        }
    });
});

describe('route lookup', () => {
    it('lists every route once', () => {
        expect(new Set(ROUTE_NAMES).size).toBe(ROUTE_NAMES.length);
        expect(ROUTE_NAMES.length).toBe(Object.keys(STORY_ROUTES).length + Object.keys(GLOBAL_ROUTES).length);
    });

    it('recognizes route names', () => {
        expect(isRouteName('getChapter')).toBe(true);
        expect(isRouteName('health')).toBe(true);
        expect(isRouteName('toString')).toBe(false);
    });

    it('builds absolute templates with the story id in front of story routes', () => {
        expect(routeTemplate('removeChapterCharacter')).toBe(
            '/api/stories/:storyId/chapters/:chapterId/characters/:characterId'
        );
        expect(routeTemplate('login')).toBe('/api/stories/:storyId/login');
        expect(templateParams(routeTemplate('removeChapterCharacter'))).toEqual([
            'storyId',
            'chapterId',
            'characterId',
        ]);
    });
});
