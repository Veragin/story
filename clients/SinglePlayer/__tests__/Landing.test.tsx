import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Landing } from '../src/landing/Landing';
import { buttonByText, newSession, renderWithSession, unmount } from './support/render';

const MANIFEST = {
    name: 'The Example',
    author: 'Jane',
    description: 'A short tale.',
    hasLandingImage: false,
};

afterEach(() => {
    unmount();
    vi.restoreAllMocks();
});

describe('Landing', () => {
    it('shows the story info and one button per playable character', () => {
        const container = renderWithSession(newSession(), <Landing manifest={MANIFEST} />);

        expect(container.querySelector('h1')?.textContent).toBe('The Example');
        expect(container.textContent).toContain('by Jane');
        expect(container.textContent).toContain('A short tale.');
        expect(buttonByText(container, 'Annie')).toBeDefined();
        expect(buttonByText(container, 'Thomas')).toBeDefined();
        expect(buttonByText(container, 'Continue')).toBeUndefined();
    });

    it('starts the game as the clicked character', () => {
        const session = newSession();
        const startAs = vi.spyOn(session.e, 'startAs').mockResolvedValue();
        const container = renderWithSession(session, <Landing manifest={MANIFEST} />);

        act(() => buttonByText(container, 'Thomas')?.click());

        expect(startAs).toHaveBeenCalledWith('thomas');
    });

    it('offers Continue and New game instead of the characters when a save exists', () => {
        newSession().e.saveStateToLocalStorage();
        const container = renderWithSession(newSession(), <Landing manifest={MANIFEST} />);

        expect(buttonByText(container, 'Annie')).toBeUndefined();
        expect(buttonByText(container, 'Continue')).toBeDefined();
        expect(buttonByText(container, 'New game')).toBeDefined();
    });

    it('continues a save made before the first move by starting its main character', () => {
        const first = newSession();
        first.s.mainCharacterId = 'annie';
        first.e.saveStateToLocalStorage();
        const session = newSession();
        const startAs = vi.spyOn(session.e, 'startAs').mockResolvedValue();
        const container = renderWithSession(session, <Landing manifest={MANIFEST} />);

        act(() => buttonByText(container, 'Continue')?.click());

        expect(startAs).toHaveBeenCalledWith('annie');
    });

    it('continues a save with history by replaying it', async () => {
        const first = newSession();
        await first.e.startAs('annie');
        await vi.waitFor(() => expect(Object.keys(first.s.currentHistory)).not.toHaveLength(0));
        first.e.saveStateToLocalStorage();
        const session = newSession();
        const handleAutoStart = vi.spyOn(session.e, 'handleAutoStart').mockResolvedValue();
        const container = renderWithSession(session, <Landing manifest={MANIFEST} />);

        act(() => buttonByText(container, 'Continue')?.click());

        expect(handleAutoStart).toHaveBeenCalled();
    });

    it('keeps the save when New game is not confirmed', () => {
        newSession().e.saveStateToLocalStorage();
        const session = newSession();
        vi.spyOn(window, 'confirm').mockReturnValue(false);
        const container = renderWithSession(session, <Landing manifest={MANIFEST} />);

        act(() => buttonByText(container, 'New game')?.click());

        expect(session.e.hasSave()).toBe(true);
    });
});
