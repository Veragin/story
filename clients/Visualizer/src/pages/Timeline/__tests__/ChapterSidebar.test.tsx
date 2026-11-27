// @vitest-environment jsdom
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    click,
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
import { TimelineStore } from '../store/TimelineStore';
import { ChapterSidebar } from '../ChapterSidebar';

const CHAPTER = 'village';

describe('ChapterSidebar', () => {
    let stores: TMockStores;
    let store: TimelineStore;
    let openChapter: (chapterId: string) => void;

    beforeEach(async () => {
        sessionStorage.clear();
        stores = createMockStores();
        openChapter = vi.fn();
        store = new TimelineStore(stores.api, stores.events, {
            confirm: () => Promise.resolve(true),
            showReferences: vi.fn(),
            notify: vi.fn(),
            openChapter,
        });
        await store.load();
        store.select({ kind: 'chapter', id: CHAPTER });
        await mountAsync(
            <ChapterSidebar
                store={store}
                chapterId={CHAPTER}
                entities={stores.entities}
                structure={stores.structure}
            />
        );
        await act(settle);
    });

    afterEach(() => {
        unmount();
        stores.release();
    });

    it('edits and saves the chapter info', async () => {
        typeInto(get<HTMLInputElement>('[data-field="title"]'), 'Village');
        click('[data-action="save"]');
        await act(settle);
        expect((await stores.api.getChapter(CHAPTER)).title).toBe('Village');
    });

    it('discards the edits', async () => {
        const title = get<HTMLInputElement>('[data-field="title"]');
        const original = title.value;
        typeInto(title, 'Village');
        click('[data-action="discard"]');
        await act(settle);
        expect(get<HTMLInputElement>('[data-field="title"]').value).toBe(
            original
        );
    });

    it('lists the parent chapters and selects one', () => {
        click('[data-parent="kingdom"]');
        expect(store.selected).toEqual({ kind: 'chapter', id: 'kingdom' });
    });

    it('opens the passages and closes', () => {
        click('[data-action="open"]');
        expect(openChapter).toHaveBeenCalledWith(CHAPTER);
        click('[data-action="close"]');
        expect(store.selected).toBeNull();
    });
});
