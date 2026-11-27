import '@story/shared';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TStructTypeDto } from '@story/protocol';
import {
    click,
    get,
    mountAsync,
    typeInto,
    unmount,
} from '../../../components/inputs/__tests__/dom';
import { CreateClassDialog } from '../CreateClassDialog';
import {
    createMockStores,
    settle,
    type TMockStores,
} from '../../../stores/__tests__/mockStores';

describe('CreateClassDialog', () => {
    let stores: TMockStores;
    let created: ReturnType<typeof vi.fn<(type: TStructTypeDto) => void>>;

    beforeEach(async () => {
        stores = createMockStores();
        await act(settle);
        created = vi.fn<(type: TStructTypeDto) => void>();
        await mountAsync(
            <CreateClassDialog
                structure={stores.structure}
                onCreated={created}
                onClose={() => {}}
            />
        );
    });

    afterEach(() => {
        unmount();
        stores.release();
    });

    const nameInput = () => get<HTMLInputElement>('input[aria-label="Name"]');
    const pluralInput = () =>
        get<HTMLInputElement>('input[aria-label="Plural name"]');

    const submit = () =>
        act(async () => {
            click('[role=dialog] button[type=submit]');
            await settle();
        });

    it('derives the plural with the English rule, keeps an edited one, and creates a class', async () => {
        typeInto(nameInput(), 'City');
        expect(pluralInput().value).toBe('cities');
        expect(get('[role=dialog]').textContent).toContain('TCityId');
        typeInto(pluralInput(), 'towns');
        typeInto(nameInput(), 'Town');
        expect(pluralInput().value).toBe('towns');

        await submit();
        expect(created).toHaveBeenCalledWith(
            expect.objectContaining({
                name: 'Town',
                kind: 'class',
                catalog: expect.objectContaining({
                    name: 'towns',
                    idType: 'TTownId',
                }),
            })
        );
        expect(stores.structure.type('Town')?.fields.map((f) => f.key)).toEqual(
            ['name']
        );
    });

    it('refuses a T-prefixed, reserved or taken name', async () => {
        typeInto(nameInput(), 'TCity');
        expect(get('[role=dialog]').textContent).toContain(
            'A class name starts with a capital letter'
        );
        typeInto(nameInput(), 'Item');
        expect(get('[role=dialog]').textContent).toContain(
            'Item and Chapter are reserved names'
        );
        typeInto(nameInput(), 'Race');
        expect(get('[role=dialog]').textContent).toContain(
            'That name is already used'
        );
        await submit();
        expect(created).not.toHaveBeenCalled();
    });
});
