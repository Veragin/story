import '@story/shared';
import { observable } from 'mobx';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiEvents, createMockApi, type TMockApi } from '../../api';
import { settle } from '../../stores/__tests__/mockStores';
import { PassageIndex } from '../PassageIndex';

describe('PassageIndex', () => {
    let api: TMockApi;
    let events: ApiEvents;
    let index: PassageIndex;

    const ids = () => index.passages.map((p) => p.id);

    beforeEach(async () => {
        events = new ApiEvents({ createEventSource: null });
        api = createMockApi({ events });
        const project = await api.getProject();
        index = new PassageIndex({ api, events, entities: { project } });
    });

    it("uses the attached chapter's passages without calling the api", async () => {
        const { passages } = await api.listChapterPassages('village');
        const chapter = observable({ passages }, { passages: observable.ref });
        const list = vi.spyOn(api, 'listChapterPassages');

        const release = index.attachChapter(chapter);
        index.load();
        expect(index.inChapter).toBe(true);
        expect(index.loading).toBe(false);
        expect(ids()).toEqual(['village-thomas-intro', 'village-thomas-forest', 'village-thomas-cool']);
        expect(index.passages[0]).toMatchObject({ chapterId: 'village', title: expect.any(String) });

        chapter.passages = passages.slice(1);
        expect(ids()).toEqual(['village-thomas-forest', 'village-thomas-cool']);
        expect(list).not.toHaveBeenCalled();

        release();
        expect(index.inChapter).toBe(false);
        expect(index.passages).toEqual([]);
    });

    it('lazy-loads the passages of every chapter once, after a release', async () => {
        const release = index.attachChapter({ passages: [] });
        release();
        const list = vi.spyOn(api, 'listChapterPassages');
        expect(list).not.toHaveBeenCalled();

        index.load();
        expect(index.loading).toBe(true);
        await settle();
        expect(index.loading).toBe(false);
        expect(ids()).toEqual(
            expect.arrayContaining(['village-thomas-intro', 'kingdom-annie-intro', 'kingdom-annie-palace'])
        );
        const calls = list.mock.calls.length;
        expect(calls).toBeGreaterThan(1);

        index.load();
        await settle();
        expect(list).toHaveBeenCalledTimes(calls);
    });

    it('refetches after a passage change event', async () => {
        index.load();
        await settle();
        const list = vi.spyOn(api, 'listChapterPassages');
        index.load();
        expect(list).not.toHaveBeenCalled();

        events.dispatch({ kind: 'passage', id: 'village-thomas-intro', version: null, chapterId: 'village' });
        index.load();
        await settle();
        expect(list).toHaveBeenCalled();
    });

    it('refetches after an own write, whose echo is dropped', async () => {
        index.load();
        await settle();
        await api.createPassage('village', { characterId: 'thomas', localId: 'river', type: 'screen', title: 'River' });
        await settle();
        index.load();
        await settle();
        expect(index.passages.find((p) => p.id === 'village-thomas-river')?.title).toBe('River');
    });

    it('shows the id for a title that is code', async () => {
        const [first] = (await api.listChapterPassages('village')).passages;
        if (!('title' in first)) throw new Error('expected a titled passage');
        index.attachChapter({ passages: [{ ...first, title: { code: 'x()' } }] });
        expect(index.passages[0].title).toBe(first.passageId);
    });
});
