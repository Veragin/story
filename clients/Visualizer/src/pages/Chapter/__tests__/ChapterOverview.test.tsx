// @vitest-environment jsdom
import '@story/shared'; // installs the global `_`
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiEvents, createMockApi, type TMockApi } from '../../../api';
import {
    $,
    click,
    get,
    mountAsync,
    typeInto,
    unmount,
} from '../../../components/inputs/__tests__/dom';
import { ChapterGraphStore } from '../ChapterGraphStore';
import { ChapterOverview } from '../ChapterOverview';

// lets the mock's setTimeout(0) event dispatch and its refetches settle
const settle = async () => {
    for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
};

describe('ChapterOverview', () => {
    let api: TMockApi;
    let events: ApiEvents;
    let store: ChapterGraphStore;
    let onEditInfo: () => void;
    let onEditSource: () => void;

    beforeEach(async () => {
        sessionStorage.clear();
        events = new ApiEvents({ createEventSource: undefined });
        api = createMockApi({ events });
        store = new ChapterGraphStore({ chapterId: 'village', api, events });
        await store.load();
        onEditInfo = vi.fn();
        onEditSource = vi.fn();
        await mountAsync(
            <ChapterOverview
                store={store}
                events={events}
                onEditInfo={onEditInfo}
                onEditSource={onEditSource}
            />
        );
        await act(settle);
    });

    afterEach(() => {
        unmount();
        void store.destroy();
    });

    it('shows the chapter as heading, badge and copyable meta', () => {
        expect(get<HTMLInputElement>('[data-field="title"]').value).toBe(
            'Village Chapter'
        );
        expect(document.body.textContent).toContain('chapter');
        expect(get('[data-copy="village"]')).toBeTruthy();
        click('[data-action="edit-info"]');
        click('[data-action="edit-source"]');
        expect(onEditInfo).toHaveBeenCalled();
        expect(onEditSource).toHaveBeenCalled();
    });

    it('saves the title and the author description in place', async () => {
        const updateChapter = vi.spyOn(api, 'updateChapter');
        expect(get<HTMLButtonElement>('[data-action="save"]').disabled).toBe(
            true
        );
        typeInto(get<HTMLInputElement>('[data-field="title"]'), 'Village');
        typeInto(
            get<HTMLTextAreaElement>('textarea[data-field="docComment"]'),
            'Thomas wakes up'
        );
        click('[data-action="save"]');
        await act(settle);
        expect(updateChapter).toHaveBeenCalledWith(
            'village',
            expect.objectContaining({
                title: 'Village',
                docComment: 'Thomas wakes up',
            })
        );
        expect((await api.getChapter('village')).docComment).toBe(
            'Thomas wakes up'
        );
    });

    it('discards the edits', () => {
        typeInto(get<HTMLInputElement>('[data-field="title"]'), 'Village');
        click('[data-action="discard"]');
        expect(get<HTMLInputElement>('[data-field="title"]').value).toBe(
            'Village Chapter'
        );
        expect($('[aria-label="Unsaved changes"]')).toBeNull();
    });
});
