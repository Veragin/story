import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TUnkownPassageLinear } from '@story/core';
import { setStoryImages } from '../src/images';
import { LinearTemplate } from '../src/templates/LinearTemplate';
import { newSession, renderWithSession, unmount } from './support/render';

const WALK: TUnkownPassageLinear = {
    chapterId: 'village',
    characterId: 'thomas',
    id: 'walk',
    type: 'linear',
    description: 'You walk on.\nThe road is long.',
    nextPassageId: 'village-thomas-forest',
};

const renderPassage = (passage: TUnkownPassageLinear) => {
    const session = newSession();
    const container = renderWithSession(
        session,
        <LinearTemplate passage={passage} />
    );
    return { container, session };
};

const linksIn = (container: HTMLElement) =>
    [...container.querySelectorAll('a')].map((a) => a.textContent);

afterEach(() => {
    unmount();
    setStoryImages({});
    vi.restoreAllMocks();
});

describe('LinearTemplate', () => {
    it('renders the passage image, the description lines and one Continue link', () => {
        setStoryImages({
            'chapters/village/thomas.passages/walk.png': 'walk.png',
        });

        const { container } = renderPassage(WALK);

        expect(container.querySelector('img')?.getAttribute('src')).toBe(
            'walk.png'
        );
        expect(container.textContent).toContain('You walk on.');
        expect(container.textContent).toContain('The road is long.');
        expect(linksIn(container)).toEqual(['Continue']);
    });

    it('goes to nextPassageId at no cost when Continue is clicked', () => {
        const { container, session } = renderPassage(WALK);
        const goToPassage = vi
            .spyOn(session.e.story, 'goToPassage')
            .mockImplementation(() => {});

        act(() => container.querySelector('a')?.click());

        expect(goToPassage).toHaveBeenCalledWith({
            text: 'Continue',
            passageId: 'village-thomas-forest',
        });
    });

    it('shows no link without nextPassageId', () => {
        const { container } = renderPassage({
            ...WALK,
            nextPassageId: undefined,
        });

        expect(container.textContent).toContain('You walk on.');
        expect(linksIn(container)).toEqual([]);
    });
});
