import '@story/shared';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TStructTypeDto } from '@story/protocol';
import {
    $,
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

    const nameInput = () => get<HTMLInputElement>('input[aria-label="Name"]');

    const submit = () =>
        act(async () => {
            click('[role=dialog] button[type=submit]');
            await settle();
        });

    it('has no catalog option', () => {
        expect($('input[aria-label="Has a catalog"]')).toBeNull();
        expect($('[data-field="catalogName"]')).toBeNull();
    });

    it('refuses a class-like or taken name and creates a type', async () => {
        typeInto(nameInput(), 'Data');
        expect(get('[role=dialog]').textContent).toContain(
            'A name starts with T and a capital letter'
        );
        typeInto(nameInput(), 'TStats');
        expect(get('[role=dialog]').textContent).toContain(
            'That name is already used'
        );
        await submit();
        expect(created).not.toHaveBeenCalled();

        typeInto(nameInput(), 'TData');
        await submit();
        expect(created).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'TData', kind: 'type', fields: [] })
        );
        expect(stores.structure.type('TData')?.catalog).toBeUndefined();
        expect(stores.structure.storyTypes.map((t) => t.name)).toContain(
            'TData'
        );
    });
});
