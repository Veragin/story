import '@story/shared'; // installs the global `_`
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApiEvents, createMockApi } from '../../../api';
import { click, doubleClick, drag } from '../../../canvas/__tests__/helpers';
import { get, mount, unmount } from '../../../components/inputs/__tests__/dom';
import { ChapterGraphStore } from '../ChapterGraphStore';
import { BOX } from '../graph/autoLayout';
import { ChapterGraphCanvas } from '../graph/ChapterGraphCanvas';

const CAMERA_OFFSET = 40;
const PASSAGE_ID = 'kingdom-annie-intro';

describe('ChapterGraphCanvas', () => {
    let store: ChapterGraphStore;
    let canvas: HTMLCanvasElement;

    const boxCenter = (passageId: string): [number, number] => {
        const p = store.positions[passageId];
        if (!p) throw new Error(`No position for ${passageId}`);
        return [
            p.x + BOX.width / 2 + CAMERA_OFFSET,
            p.y + BOX.height / 2 + CAMERA_OFFSET,
        ];
    };

    beforeEach(async () => {
        sessionStorage.clear();
        const events = new ApiEvents({ createEventSource: undefined });
        const api = createMockApi({ events });
        store = new ChapterGraphStore({ chapterId: 'kingdom', api, events });
        await store.load();
        mount(<ChapterGraphCanvas store={store} />);
        canvas = get<HTMLCanvasElement>('canvas');
    });

    afterEach(() => {
        unmount();
        void store.destroy();
    });

    it('a single click on a passage selects it and opens its editor', () => {
        act(() => click(canvas, ...boxCenter(PASSAGE_ID)));
        expect(store.selectedId).toBe(PASSAGE_ID);
        expect(store.editor?.passageId).toBe(PASSAGE_ID);
    });

    it('dragging a passage moves it without opening its editor', () => {
        const [x, y] = boxCenter(PASSAGE_ID);
        const before = store.positions[PASSAGE_ID];
        act(() => drag(canvas, [x, y], [x + 60, y + 30]));
        expect(store.selectedId).toBe(PASSAGE_ID);
        expect(store.editor).toBeNull();
        expect(store.positions[PASSAGE_ID]).toEqual({
            x: (before?.x ?? 0) + 60,
            y: (before?.y ?? 0) + 30,
        });
    });

    it('a click on empty canvas deselects but keeps the editor open', () => {
        act(() => click(canvas, ...boxCenter(PASSAGE_ID)));
        act(() => click(canvas, 5000, 5000));
        expect(store.selectedId).toBeNull();
        expect(store.editor?.passageId).toBe(PASSAGE_ID);
    });

    it('selecting programmatically does not open the editor', () => {
        act(() => store.select(PASSAGE_ID));
        expect(store.editor).toBeNull();
    });

    it('a double click still opens the editor', () => {
        act(() => doubleClick(canvas, ...boxCenter(PASSAGE_ID)));
        expect(store.editor?.passageId).toBe(PASSAGE_ID);
    });
});
