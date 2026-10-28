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
                onClose={() => {}}
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
        typeInto(get<HTMLInputElement>('input[aria-label="Name"]'), 'TCity');
        expect(
            get<HTMLInputElement>('input[aria-label="Catalog name"]').value
        ).toBe('cities');
        typeInto(
            get<HTMLInputElement>('input[aria-label="Catalog name"]'),
            'towns'
        );
        typeInto(get<HTMLInputElement>('input[aria-label="Name"]'), 'TTown');
        expect(
            get<HTMLInputElement>('input[aria-label="Catalog name"]').value
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
        typeInto(get<HTMLInputElement>('input[aria-label="Name"]'), 'TRace');
        expect(get('[role=dialog]').textContent).toContain(
            'That name is already used'
        );
        await submit();
        expect(created).not.toHaveBeenCalled();

        typeInto(get<HTMLInputElement>('input[aria-label="Name"]'), 'TMood');
        click('input[aria-label="Has a catalog"]');
        await submit();
        expect(created).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'TMood', fields: [] })
        );
        expect(stores.structure.type('TMood')?.catalog).toBeUndefined();
    });
});
