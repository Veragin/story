import { act } from 'react';
import { runInAction } from 'mobx';
import { afterEach, describe, expect, it } from 'vitest';
import { Inventory } from '../src/templates/Components/Inventory/Inventory';
import { newSession, renderWithSession, unmount } from './support/render';

afterEach(unmount);

describe('Inventory', () => {
    it('shows the main character"s items as cards grouped by type, with amount and info', () => {
        const session = newSession();
        session.s.mainCharacterId = 'annie';

        const container = renderWithSession(session, <Inventory />);

        expect(container.querySelector('h3')?.textContent).toBe('Food');
        expect(container.textContent).toContain('Berries');
        expect(container.textContent).toContain('×10');
        expect(container.textContent).toContain('Hunger value: 5');
        expect(container.querySelector('button')).toBeNull();
    });

    it('shows an empty state', () => {
        const session = newSession();
        session.s.mainCharacterId = 'annie';
        const container = renderWithSession(session, <Inventory />);

        act(() =>
            runInAction(() => session.e.inventory.removeItem({ id: 'berries', amount: 10 }, 'annie'))
        );

        expect(container.textContent).toBe('Your inventory is empty.');
    });
});
