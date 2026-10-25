import { act } from 'react';
import { runInAction } from 'mobx';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TTopbarProps } from '@story/types';
import { StatusBar } from '../src/templates/Components/StatusBar';
import { newSession, renderWithSession, unmount } from './support/render';

afterEach(() => {
    unmount();
    vi.restoreAllMocks();
});

const GoldTopbar = ({ s }: TTopbarProps) => (
    <span data-testid="topbar">Gold {s.characters.thomas.health}</span>
);

const ThrowingTopbar = (): never => {
    throw new Error('broken topbar');
};

const renderStatusBar = async (session: ReturnType<typeof newSession>) => {
    const container = renderWithSession(session, <StatusBar />);
    // the story's Topbar is a dynamic import: let it resolve and re-render
    await act(async () => {
        await vi.dynamicImportSettled();
    });
    return container;
};

describe('StatusBar topbar', () => {
    it('shows the default health stat when the story has no Topbar', async () => {
        const session = newSession({});

        const container = await renderStatusBar(session);

        expect(
            container.querySelector('[data-testid="FavoriteIcon"]')
        ).not.toBeNull();
        expect(container.textContent).toContain('100%');
    });

    it('renders a custom Topbar and re-renders it when the world state changes', async () => {
        const session = newSession({
            Topbar: () => Promise.resolve({ Topbar: GoldTopbar }),
        });

        const container = await renderStatusBar(session);
        expect(
            container.querySelector('[data-testid="topbar"]')?.textContent
        ).toBe('Gold 100');

        act(() =>
            runInAction(() => {
                session.s.characters.thomas.health = 42;
            })
        );

        expect(
            container.querySelector('[data-testid="topbar"]')?.textContent
        ).toBe('Gold 42');
    });

    it('falls back to the default stats when the Topbar throws', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const session = newSession({
            Topbar: () => Promise.resolve({ Topbar: ThrowingTopbar }),
        });

        const container = await renderStatusBar(session);

        expect(
            container.querySelector('[data-testid="FavoriteIcon"]')
        ).not.toBeNull();
        expect(container.textContent).toContain('100%');
    });

    it('falls back to the default stats when the Topbar fails to load', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const session = newSession({
            Topbar: () => Promise.reject(new Error('404')),
        });

        const container = await renderStatusBar(session);

        expect(
            container.querySelector('[data-testid="FavoriteIcon"]')
        ).not.toBeNull();
    });
});
