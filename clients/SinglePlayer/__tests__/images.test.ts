import { relativePath, resolvePath } from '@story/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { passageImage, setStoryImages, storyImageFiles } from '../src/images';

const FOREST = { chapterId: 'village', characterId: 'thomas', id: 'forest' };

afterEach(() => setStoryImages({}));

describe('story paths', () => {
    it('resolves a path relative to a folder', () => {
        expect(resolvePath('data/a/b', 'c.png')).toBe('data/a/b/c.png');
        expect(resolvePath('data/a/b', './../x/./c.png')).toBe('data/a/x/c.png');
        expect(resolvePath('a', '../../c.png')).toBeUndefined();
    });

    it('relates a file to a folder', () => {
        expect(relativePath('data/a/b', 'data/a/b/c.png')).toBe('c.png');
        expect(relativePath('data/a/b', 'data/x/c.png')).toBe('../../x/c.png');
    });
});

describe('passageImage', () => {
    it('keeps only the png and webp files of the data folder', () => {
        expect(
            storyImageFiles(['data/a.png', 'data/b.webp', 'data/a.ts', 'types/b.png'], (file) => `url/${file}`)
        ).toEqual({
            'a.png': 'url/data/a.png',
            'b.webp': 'url/data/b.webp',
        });
    });

    it('is the webp next to the passage file', () => {
        setStoryImages({ 'chapters/village/thomas.passages/forest.webp': 'forest-url' });
        expect(passageImage({ ...FOREST, image: 'A misty forest' })).toBe('forest-url');
    });

    it('prefers the webp over the png of the same name', () => {
        setStoryImages({
            'chapters/village/thomas.passages/forest.webp': 'webp-url',
            'chapters/village/thomas.passages/forest.png': 'png-url',
        });
        expect(passageImage({ ...FOREST, image: 'A misty forest' })).toBe('webp-url');
    });

    it('follows an @ link to a webp', () => {
        setStoryImages({ 'chapters/village/thomas.passages/intro.webp': 'intro-url' });
        expect(passageImage({ ...FOREST, image: '@intro.webp' })).toBe('intro-url');
    });

    it('is the png next to the passage file', () => {
        setStoryImages({ 'chapters/village/thomas.passages/forest.png': 'forest-url' });
        expect(passageImage({ ...FOREST, image: 'A misty forest' })).toBe('forest-url');
    });

    it('follows an @ link relative to the passage file instead', () => {
        setStoryImages({
            'chapters/village/thomas.passages/forest.png': 'forest-url',
            'chapters/village/thomas.passages/intro.png': 'intro-url',
            'chapters/kingdom/annie.passages/palace.png': 'palace-url',
        });
        expect(passageImage({ ...FOREST, image: '@intro.png' })).toBe('intro-url');
        expect(passageImage({ ...FOREST, image: '@ ../../kingdom/annie.passages/palace.png' })).toBe('palace-url');
    });

    it('shows nothing for a link to a missing image or out of the data folder', () => {
        setStoryImages({ 'chapters/village/thomas.passages/forest.png': 'forest-url' });
        expect(passageImage({ ...FOREST, image: '@missing.png' })).toBeUndefined();
        expect(passageImage({ ...FOREST, image: '@../../../../forest.png' })).toBeUndefined();
        expect(passageImage({ ...FOREST, image: '@' })).toBeUndefined();
    });
});
