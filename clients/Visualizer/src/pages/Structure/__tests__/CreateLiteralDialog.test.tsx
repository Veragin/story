import '@story/shared';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TLiteralDto } from '@story/protocol';
import {
    $,
    click,
    get,
    mountAsync,
    typeInto,
    unmount,
} from '../../../components/inputs/__tests__/dom';
import { CreateLiteralDialog } from '../CreateLiteralDialog';
import {
    createMockStores,
    settle,
    type TMockStores,
} from '../../../stores/__tests__/mockStores';

describe('CreateLiteralDialog', () => {
    let stores: TMockStores;
    let created: ReturnType<typeof vi.fn<(literal: TLiteralDto) => void>>;

    const render = (owner?: string) =>
        mountAsync(
            <CreateLiteralDialog
                structure={stores.structure}
                owner={owner}
                onCreated={created}
                onClose={() => {}}
            />
        );

    beforeEach(async () => {
        stores = createMockStores();
        await act(settle);
        created = vi.fn<(literal: TLiteralDto) => void>();
    });

    afterEach(() => {
        unmount();
        stores.release();
    });

    const fill = (name: string, value: string) => {
        typeInto(get<HTMLInputElement>('input[aria-label="Name"]'), name);
        const values = get<HTMLInputElement>('[data-field="values"] input');
        typeInto(values, value);
        act(() => {
            values.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
            );
        });
    };

    const submit = () =>
        act(async () => {
            click('[role=dialog] button[type=submit]');
            await settle();
        });

    const scope = () =>
        get<HTMLInputElement>('[data-field="scope"] input:checked').value;

    it('creates a private literal of the given class in its file', async () => {
        await render('Race');
        expect(get('[role=dialog]').textContent).toContain(
            'New private literal of Race'
        );
        expect(scope()).toBe('private');
        expect(get('[data-field="scope"]').textContent).toContain(
            'Private (class Race)'
        );
        expect($('[data-field="owner"]')).toBeNull();
        fill('TRaceTone', 'low');
        await submit();
        expect(created).toHaveBeenCalledWith(
            expect.objectContaining({
                name: 'TRaceTone',
                scope: 'private',
                owner: 'Race',
                file: 'types/Race.ts',
            })
        );
    });

    it('starts global, and asks for the class of a private literal', async () => {
        await render();
        expect(scope()).toBe('global');
        act(() =>
            get<HTMLInputElement>(
                '[data-field="scope"] input[value="private"]'
            ).click()
        );
        expect($('[data-field="owner"]')).not.toBeNull();
        fill('TRaceTone', 'low');
        await submit();
        expect(created).not.toHaveBeenCalled();
    });
});
