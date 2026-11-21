import { afterEach, describe, expect, it } from 'vitest';
import { setStoryImages } from '../src/images';
import { PassageLayout } from '../src/templates/Components/PassageLayout';
import { newSession, renderWithSession, unmount } from './support/render';

const FOREST = {
    chapterId: 'village',
    characterId: 'thomas',
    id: 'forest',
};

const renderLayout = (image: string) =>
    renderWithSession(
        newSession({}),
        <PassageLayout passage={{ ...FOREST, image }}>
            <p>body</p>
        </PassageLayout>
    );

const passageImg = (container: HTMLElement) =>
    container.querySelector('img[src="forest-url"]');

afterEach(() => {
    unmount();
    setStoryImages({});
});

describe('PassageLayout', () => {
    it('describes the image with names instead of mentions', () => {
        setStoryImages({
            'chapters/village/thomas.passages/forest.png': 'forest-url',
        });

        const container = renderLayout(
            '@character:thomas meets @npc:nobleMan in @chapter:village, after @passage:village-thomas-intro.'
        );

        const description =
            'Thomas meets Noble Man in Village Chapter, after village-thomas-intro.';
        expect(passageImg(container)?.getAttribute('alt')).toBe(description);
        expect(passageImg(container)?.getAttribute('title')).toBe(description);
    });

    it('shows the id of an unknown entity', () => {
        setStoryImages({
            'chapters/village/thomas.passages/forest.png': 'forest-url',
        });

        const container = renderLayout('@location:castle at dusk');

        expect(passageImg(container)?.getAttribute('alt')).toBe(
            'castle at dusk'
        );
    });

    it('has no description for a linked image', () => {
        setStoryImages({
            'chapters/village/thomas.passages/intro.png': 'forest-url',
        });

        const container = renderLayout('@intro.png');

        expect(passageImg(container)?.getAttribute('alt')).toBe('');
        expect(passageImg(container)?.hasAttribute('title')).toBe(false);
    });
});
