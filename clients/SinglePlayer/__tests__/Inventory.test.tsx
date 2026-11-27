import { act } from 'react';
import { runInAction } from 'mobx';
import { afterEach, describe, expect, it } from 'vitest';
import { Inventory } from '../src/templates/Components/Inventory/Inventory';
import { newSession, renderWithSession, unmount } from './support/render';

afterEach(unmount);

const tabs = (container: HTMLElement) => [...container.querySelectorAll('[role="tab"]')].map((t) => t.textContent);

const clickTab = (container: HTMLElement, tab: string) => {
    const element = container.querySelector(`[data-tab="${tab}"]`);
    if (!(element instanceof HTMLElement)) throw new Error(`tab ${tab} not found`);
    act(() => element.click());
};

const annieSession = () => {
    const session = newSession();
    session.s.mainCharacterId = 'annie';
    return session;
};

describe('Inventory', () => {
    it('shows an All tab and a tab per item type of the story, with item counts', () => {
        const container = renderWithSession(annieSession(), <Inventory />);

        expect(tabs(container)).toEqual([
            'All (1)',
            'Weapon (0)',
            'Tool (0)',
            'Food (1)',
            'Resource (0)',
            'Value (0)',
        ]);
        expect(container.querySelector('[data-tab="all"]')?.getAttribute('aria-selected')).toBe('true');
    });

    it('shows the main character"s items as cards with amount and info', () => {
        const container = renderWithSession(annieSession(), <Inventory />);

        expect(container.textContent).toContain('Berries');
        expect(container.textContent).toContain('×10');
        expect(container.textContent).toContain('Hunger value: 5');
    });

    it('filters the items by the selected type', () => {
        const session = annieSession();
        const container = renderWithSession(session, <Inventory />);
        act(() => runInAction(() => session.e.inventory.addItem({ id: 'wood', amount: 3 }, 'annie')));

        clickTab(container, 'resource');
        expect(container.textContent).toContain('Wood');
        expect(container.textContent).not.toContain('Berries');

        clickTab(container, 'weapon');
        expect(container.textContent).toContain('No items of this type.');

        clickTab(container, 'all');
        expect(container.textContent).toContain('Wood');
        expect(container.textContent).toContain('Berries');
    });

    it('shows an empty state', () => {
        const session = annieSession();
        const container = renderWithSession(session, <Inventory />);

        act(() => runInAction(() => session.e.inventory.removeItem({ id: 'berries', amount: 10 }, 'annie')));

        expect(container.textContent).toContain('Your inventory is empty.');
    });
});
