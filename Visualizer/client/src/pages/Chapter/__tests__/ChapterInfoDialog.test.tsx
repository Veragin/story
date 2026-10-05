// @vitest-environment jsdom
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../api';
import {
    $,
    $$,
    click,
    flush,
    get,
    mountAsync,
    typeInto,
    unmount,
} from '../../../components/inputs/__tests__/dom';
import {
    createMockStores,
    settle,
    type TMockStores,
} from '../../../stores/__tests__/mockStores';
import { ChapterInfoDialog } from '../ChapterInfoForm/ChapterInfoDialog';

describe('ChapterInfoDialog', () => {
    let stores: TMockStores;
    let onClose: () => void;

    const open = async (chapterId: string) => {
        await mountAsync(
            <ChapterInfoDialog
                chapterId={chapterId}
                api={stores.api}
                structure={stores.structure}
                entities={stores.entities}
                events={stores.events}
                onClose={onClose}
            />
        );
        await act(settle);
    };

    const saveButton = () => {
        const button = $$<HTMLButtonElement>('button').find(
            (b) => b.textContent === 'Save'
        );
        if (!button) throw new Error('No Save button');
        return button;
    };

    beforeEach(() => {
        sessionStorage.clear();
        stores = createMockStores();
        onClose = vi.fn();
    });

    afterEach(() => {
        unmount();
        stores.release();
    });

    it('renders the chapter on the new inputs, init typed by the data type', async () => {
        await open('kingdom');
        const labels = $$('[data-form-field]').map(
            (el) => el.dataset.formField
        );
        expect(labels).toEqual(
            expect.arrayContaining([
                'Title',
                'Description',
                'Location',
                'Time range',
                'Child chapters',
                'Init',
                'data type TKingdomChapterData',
            ])
        );
        expect(get<HTMLInputElement>('[data-field="title"]').value).toBe(
            'Kingdom Chapter'
        );
        expect(
            get('[data-form-field="Init"] [data-form-field="mojePromena"]')
        ).toBeTruthy();
        expect(
            get<HTMLInputElement>('[data-field="timeRange.start"]').value
        ).toBe('2.1. 8:00');
    });

    it('saves the edited fields only', async () => {
        await open('village');
        typeInto(get<HTMLInputElement>('[data-field="title"]'), 'Village');
        typeInto(
            get<HTMLInputElement>('[data-field="timeRange.end"]'),
            '6.1. 8:00'
        );
        act(() => saveButton().click());
        await act(settle);
        const saved = await stores.api.getChapter('village');
        expect(saved.title).toBe('Village');
        expect(saved.timeRange).toEqual({
            start: '2.1. 8:00',
            end: '6.1. 8:00',
        });
        expect(saved.description).toBe('A village chapter is happening');
        expect(onClose).toHaveBeenCalled();
    });

    it('fills a new required data-type field into init and saves both', async () => {
        await open('wedding');
        click(
            '[data-form-field="data type TWeddingChapterData"] [data-action="add-structure-field"]'
        );
        await flush();
        expect(
            get('[data-form-field="Init"] [data-form-field="field"]')
        ).toBeTruthy();
        typeInto(get<HTMLInputElement>('[data-field="field-key"]'), 'mood');
        await flush();
        expect(
            $('[data-form-field="Init"] [data-form-field="field"]')
        ).toBeNull();
        act(() => saveButton().click());
        await act(settle);
        const saved = await stores.api.getChapter('wedding');
        expect(saved.init).toEqual({ mood: '' });
        expect(saved.dataType?.fields?.map((f) => f.key)).toEqual(['mood']);
    });

    it('offers the other chapters as children, never itself', async () => {
        await open('kingdom');
        click('[data-form-field="Child chapters"] [data-action="add-item"]');
        await flush();
        const ids = $$<HTMLInputElement>(
            '[data-form-field="Child chapters"] input'
        )
            .map((el) => el.value)
            .filter((v) => v !== '');
        expect(ids).not.toContain('kingdom');
    });

    it('shows save diagnostics at the nested init field and the rest above the form', async () => {
        await open('village');
        const diagnostic = (message: string, field?: string) => ({
            file: 'f.ts',
            line: 1,
            column: 1,
            message,
            field,
        });
        vi.spyOn(stores.api, 'updateChapter').mockRejectedValue(
            new ApiError(422, {
                error: 'invalid',
                diagnostics: [
                    diagnostic('Not a number', 'init.mojePromena.time'),
                    diagnostic('Somewhere else'),
                ],
            })
        );
        typeInto(get<HTMLInputElement>('[data-field="title"]'), 'Village');
        act(() => saveButton().click());
        await act(settle);
        expect(get('[data-form-field="time"]').textContent).toContain(
            'Not a number'
        );
        expect(get('[data-form-field="Title"]').textContent).not.toContain(
            'Not a number'
        );
        expect(document.body.textContent).toContain('Somewhere else');
        expect(onClose).not.toHaveBeenCalled();
    });
});
