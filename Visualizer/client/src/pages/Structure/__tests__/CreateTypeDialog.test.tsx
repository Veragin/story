import '@story/shared';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TStructTypeDto } from '@story/visualizer-protocol';
import {
    click,
    get,
    mountAsync,
    typeInto,
    unmount,
} from '../../../components/inputs/__tests__/dom';
import { CreateTypeDialog } from '../CreateTypeDialog';
import {
    createMockStores,
    settle,
    type TMockStores,
} from '../../../stores/__tests__/mockStores';

describe('CreateTypeDialog', () => {
    let stores: TMockStores;
    let created: ReturnType<typeof vi.fn<(type: TStructTypeDto) => void>>;

    beforeEach(async () => {
        stores = createMockStores();
        await act(settle);
        created = vi.fn<(type: TStructTypeDto) => void>();
        await mountAsync(
            <CreateTypeDialog
                structure={stores.structure}
                onCreated={created}
                onCancel={() => {}}
            />
        );
    });

    afterEach(() => {
        unmount();
        stores.release();
    });

    const submit = () =>
        act(async () => {
            click('[role=dialog] button[type=submit]');
            await settle();
        });

    it('derives the catalog name with the English plural rule, and keeps an edited one', async () => {
        typeInto(get<HTMLInputElement>('input[aria-label="name"]'), 'TCity');
        expect(
            get<HTMLInputElement>('input[aria-label="catalog name"]').value
        ).toBe('cities');
        typeInto(
            get<HTMLInputElement>('input[aria-label="catalog name"]'),
            'towns'
        );
        typeInto(get<HTMLInputElement>('input[aria-label="name"]'), 'TTown');
        expect(
            get<HTMLInputElement>('input[aria-label="catalog name"]').value
        ).toBe('towns');

        await submit();
        expect(created).toHaveBeenCalledWith(
            expect.objectContaining({
                name: 'TTown',
                catalog: expect.objectContaining({ name: 'towns' }),
            })
        );
        expect(
            stores.structure.type('TTown')?.fields.map((f) => f.key)
        ).toEqual(['name']);
    });

    it('refuses a taken name and creates a type without a catalog', async () => {
        typeInto(get<HTMLInputElement>('input[aria-label="name"]'), 'TRace');
        expect(get('[role=dialog]').textContent).toContain(
            'That name is already used'
        );
        await submit();
        expect(created).not.toHaveBeenCalled();

        typeInto(get<HTMLInputElement>('input[aria-label="name"]'), 'TMood');
        click('input[aria-label="catalog"]');
        await submit();
        expect(created).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'TMood', fields: [] })
        );
        expect(stores.structure.type('TMood')?.catalog).toBeUndefined();
    });
});
