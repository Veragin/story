import { describe, expect, it } from 'vitest';
import {
    buildGlobalPath,
    buildPath,
    GLOBAL_ROUTES,
    matchPath,
    splitStoryPath,
    STORY_ROUTE_NAMES,
    STORY_ROUTES,
    storyApiPrefix,
    templateParams,
} from '../src';

describe('protocol paths', () => {
    it('buildPath fills and encodes templates under the story prefix', () => {
        expect(buildPath('example', 'getChapter', { chapterId: 'village' })).toBe(
            '/api/stories/example/chapters/village'
        );
        expect(buildPath('example', 'removeChapterCharacter', { chapterId: 'a b', characterId: 'thomas' })).toBe(
            '/api/stories/example/chapters/a%20b/characters/thomas'
        );
        expect(buildPath('other', 'getEntity', { kind: 'npcs', id: 'franta' })).toBe(
            '/api/stories/other/entities/npcs/franta'
        );
        expect(buildGlobalPath('health', {})).toBe('/api/health');
        expect(buildGlobalPath('listStories', {})).toBe('/api/stories');
    });

    it('splitStoryPath + matchPath invert an encoded path for every story route', () => {
        for (const route of STORY_ROUTE_NAMES) {
            const template = STORY_ROUTES[route].path;
            const params = Object.fromEntries(templateParams(template).map((name) => [name, `${name}-x y`]));
            const filled = template.replace(/:([A-Za-z]+)/g, (_match, name: string) =>
                encodeURIComponent(params[name])
            );
            const split = splitStoryPath(storyApiPrefix('my-story') + filled);
            expect(split).toEqual({ storyId: 'my-story', rest: expect.any(String) });
            expect(matchPath(template, split?.rest ?? '')).toEqual(params);
        }
        expect(matchPath('/chapters/:chapterId', '/chapters/')).toBeNull();
        expect(matchPath('/chapters/:chapterId', '/chapters/a/b')).toBeNull();
    });

    it('splitStoryPath only splits paths below a story', () => {
        expect(splitStoryPath('/api/stories')).toBeNull();
        expect(splitStoryPath('/api/stories/example')).toBeNull();
        expect(splitStoryPath('/api/health')).toBeNull();
        expect(splitStoryPath('/api/stories/example/')).toEqual({ storyId: 'example', rest: '/' });
        expect(splitStoryPath('/api/stories/%E0/project')).toBeNull();
    });

    it('story routes are relative, global routes are under /api', () => {
        expect(storyApiPrefix('example')).toBe('/api/stories/example');
        for (const def of Object.values(STORY_ROUTES)) {
            expect(def.path.startsWith('/')).toBe(true);
            expect(def.path.startsWith('/api')).toBe(false);
        }
        for (const def of Object.values(GLOBAL_ROUTES)) expect(def.path.startsWith('/api/')).toBe(true);
    });
});
