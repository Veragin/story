import { describe, expect, it } from 'vitest';
import { imageDescription, imageLinkPath } from '../src/storyImage';

const REAL_LINKS: [string, string][] = [
    ['@../thomas.png', '../thomas.png'],
    ['@characters/thomas.png', 'characters/thomas.png'],
    ['@./x.webp', './x.webp'],
    ['@village-thomas-intro.png', 'village-thomas-intro.png'],
    ['@../../locations/village.location.webp', '../../locations/village.location.webp'],
    ['@ ../npcs/herbalist.png ', '../npcs/herbalist.png'],
    ['@character.png', 'character.png'],
    ['@characters:thomas.png', 'characters:thomas.png'],
];

describe('imageLinkPath', () => {
    it.each(REAL_LINKS)('reads %j as a link to %j', (image, path) => {
        expect(imageLinkPath(image)).toBe(path);
    });

    it('reads text starting with a mention as a description', () => {
        expect(imageLinkPath('@character:thomas standing in @location:village')).toBeUndefined();
        expect(imageLinkPath('@passage:village-thomas-intro, at night')).toBeUndefined();
        expect(imageLinkPath('@item:')).toBeUndefined();
    });

    it('reads plain text as a description', () => {
        expect(imageLinkPath('a quiet square')).toBeUndefined();
        expect(imageLinkPath('')).toBeUndefined();
    });
});

describe('imageDescription', () => {
    const nameOf = (mentionClass: string, id: string) => (id === 'thomas' ? 'Thomas' : undefined);

    it('is empty for a link', () => {
        expect(imageDescription('@../thomas.png', nameOf)).toBe('');
    });

    it('describes the mentions, by name or by id', () => {
        expect(imageDescription('@character:thomas in @location:village', nameOf)).toBe('Thomas in village');
        expect(imageDescription('@character:thomas in @location:village')).toBe('thomas in village');
        expect(imageDescription('a quiet square')).toBe('a quiet square');
    });
});
