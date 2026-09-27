import { describe, expect, it } from 'vitest';
import { pathToResource } from '../src/events/pathToEvent';

describe('pathToResource', () => {
    it.each([
        [
            'data/chapters/village/village.chapter.ts',
            { kind: 'chapter', id: 'village', chapterId: 'village', primary: true },
        ],
        [
            'data/chapters/village/village.passages.ts',
            { kind: 'chapter', id: 'village', chapterId: 'village', primary: false },
        ],
        ['data/chapters/village/triggers.ts', { kind: 'trigger', id: '*', chapterId: 'village', primary: false }],
        [
            'data/chapters/village/thomas.passages/intro.ts',
            { kind: 'passage', id: 'village-thomas-intro', chapterId: 'village', primary: true },
        ],
        [
            'data/chapters/village/thomas.passages/cool.transition.ts',
            { kind: 'passage', id: 'village-thomas-cool', chapterId: 'village', primary: true },
        ],
        [
            'data/chapters/kingdom/thomas.passages/visit.screen.ts',
            { kind: 'passage', id: 'kingdom-thomas-visit', chapterId: 'kingdom', primary: true },
        ],
        [
            'data/chapters/village/village.layout.json',
            { kind: 'layout', id: 'chapters/village', chapterId: 'village', primary: true },
        ],
        ['data/chapters/timeline.layout.json', { kind: 'layout', id: 'timeline', primary: true }],
        ['data/locations/map.json', { kind: 'map', id: 'global', primary: true }],
        ['data/locations/village.location.ts', { kind: 'entity', id: 'locations/village', primary: true }],
        ['data/characters/thomas.ts', { kind: 'entity', id: 'characters/thomas', primary: true }],
        ['data/npcs/Franta.ts', { kind: 'entity', id: 'npcs/franta', primary: true }],
        ['data/npcs/NobleMan.ts', { kind: 'entity', id: 'npcs/nobleMan', primary: true }],
        ['data/items/foodInfo.ts', { kind: 'entity', id: 'items/*', primary: false }],
        ['data/register.ts', { kind: 'project', id: 'project', primary: false }],
        ['data/TWorldState.ts', { kind: 'project', id: 'project', primary: false }],
        ['types/TChapter.ts', { kind: 'project', id: 'project', primary: false }],
    ])('%s', (file, expected) => {
        expect(pathToResource(file)).toEqual(expected);
    });

    it.each([
        'data/test/story.test.ts',
        'data/assets/story.png',
        'data/chapters/village/thomas.passages/intro.png',
        'data/characters/thomas.png',
        'data/npcs/Franta.png',
        'data/package.json',
        'data/chapters/village/.village.chapter.ts.abc123.vistmp',
        'data/chapters/village/thomas.passages/notes.md',
        'data/locations/readme.md',
        'types/package.json',
        'core/src/index.ts',
        'Visualizer/server/src/index.ts',
    ])('%s maps to nothing', (file) => {
        expect(pathToResource(file)).toBeNull();
    });
});
