import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DAY_S, HOUR_S, TimeManager } from '@story/shared';
import { ApiError, ApiEvents, createMockApi, type TMockApi } from '../../../api';
import { click, createCanvas, drag, fire, installFrames, uninstallFrames } from '../../../canvas/test/helpers';
import { TimelineView } from '../canvas/TimelineView';
import { STRIP_HEIGHT } from '../canvas/TimeStripShape';
import { TimelineStore, type TTimelineDeps } from '../store/TimelineStore';
import {
    DEFAULT_PX_PER_SECOND,
    formatTime,
    parseRange,
    parseTime,
    snapStep,
    snapTime,
    timeToX,
    xToTime,
} from '../store/timeScale';

const VILLAGE_START = parseTime('2.1. 8:00') as number; // 1 day 8 h
const VILLAGE_END = parseTime('5.1. 8:00') as number;

describe('timeScale', () => {
    it('maps time to x and back', () => {
        expect(timeToX(DAY_S, 0.01)).toBeCloseTo(864);
        expect(xToTime(864, 0.01)).toBeCloseTo(DAY_S);
        expect(xToTime(timeToX(123456, DEFAULT_PX_PER_SECOND), DEFAULT_PX_PER_SECOND)).toBeCloseTo(123456);
    });

    it('formats times the way the story files write them, and parses them back', () => {
        expect(VILLAGE_START).toBe(DAY_S + 8 * HOUR_S);
        expect(formatTime(VILLAGE_START)).toBe('2.1. 8:00');
        expect(parseTime(formatTime(VILLAGE_START + 22 * 60))).toBe(VILLAGE_START + 22 * 60);
        expect(parseTime('1.12 0:0')).toBe(parseTime(formatTime(parseTime('1.12 0:0') as number)));
        // after the first year the year is written out
        const later = 400 * DAY_S + 5 * HOUR_S;
        expect(formatTime(later)).toMatch(/^\d+\.\d+\.1621 5:00$/);
        expect(parseTime(formatTime(later))).toBe(later);
        expect(parseTime({ code: 'Time.fromS(10)' })).toBeNull();
        expect(parseRange({ start: '2.1. 8:00', end: { code: 'x' } })).toBeNull();
    });

    it('snaps to a step that is a few pixels wide', () => {
        expect(snapStep(DEFAULT_PX_PER_SECOND)).toBe(HOUR_S);
        expect(snapTime(HOUR_S * 2.4, DEFAULT_PX_PER_SECOND)).toBe(HOUR_S * 2);
        expect(snapStep(1200 / (2 * 365 * DAY_S))).toBe(DAY_S);
    });
});

type TSetup = {
    api: TMockApi;
    events: ApiEvents;
    store: TimelineStore;
    deps: { [K in keyof TTimelineDeps]: ReturnType<typeof vi.fn> };
};

const setup = async (): Promise<TSetup> => {
    const events = new ApiEvents({ createEventSource: undefined });
    const api = createMockApi({ events });
    const deps = {
        confirm: vi.fn(() => Promise.resolve(true)),
        showReferences: vi.fn(),
        notify: vi.fn(),
        openChapter: vi.fn(),
    };
    const store = new TimelineStore(api, events, deps as unknown as TTimelineDeps);
    await store.load();
    store.start();
    return { api, events, store, deps };
};

const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
    sessionStorage.clear();
});

describe('TimelineStore', () => {
    let s: TSetup;
    beforeEach(async () => {
        s = await setup();
    });
    afterEach(() => s.store.dispose());

    it('loads chapters, triggers and the layout', () => {
        expect(s.store.status).toBe('ready');
        expect(s.store.chapterIds).toEqual(['village', 'kingdom', 'wedding']);
        expect(s.store.chapterRange('village')).toEqual({ start: VILLAGE_START, end: VILLAGE_END });
        expect(s.store.triggerTime('nobleHouseRobbery')).toBe(parseTime('1.12 0:0'));
        expect(s.store.connections).toEqual([{ from: 'kingdom', to: 'village' }]);
        // no saved layout: default rows in project order
        expect(s.store.chapterY('kingdom')).toBe(70);
    });

    it('maps time to x with the current scale', () => {
        s.store.setPps(0.01);
        expect(s.store.timeToX(VILLAGE_START)).toBeCloseTo(VILLAGE_START * 0.01);
        expect(s.store.xToTime(s.store.timeToX(VILLAGE_END))).toBeCloseTo(VILLAGE_END);
    });

    it('saves a moved time range through the chapter update, with the version', async () => {
        const before = await s.api.getChapter('village');
        const update = vi.spyOn(s.api, 'updateChapter');
        await s.store.commitChapter('village', { start: VILLAGE_START + 2 * HOUR_S, end: VILLAGE_END + 2 * HOUR_S });
        expect(update).toHaveBeenCalledWith('village', {
            version: before.version,
            timeRange: { start: '2.1. 10:00', end: '5.1. 10:00' },
        });
        const after = await s.api.getChapter('village');
        expect(after.timeRange).toEqual({ start: '2.1. 10:00', end: '5.1. 10:00' });
        expect(s.store.chapters.get('village')?.version).toBe(after.version);
    });

    it('saves a y-move in the timeline layout only', async () => {
        const update = vi.spyOn(s.api, 'updateChapter');
        await s.store.commitChapter('village', { start: VILLAGE_START, end: VILLAGE_END, y: 123 });
        expect(update).not.toHaveBeenCalled();
        const layout = await s.api.getTimelineLayout();
        expect(layout.chapters.village).toEqual({ y: 123 });
        expect(s.store.layout?.version).toBe(layout.version);
        expect(s.store.chapterY('village')).toBe(123);
        // a second move uses the new version
        await s.store.commitChapter('kingdom', { y: 300 });
        expect((await s.api.getTimelineLayout()).chapters).toEqual({ village: { y: 123 }, kingdom: { y: 300 } });
    });

    it('re-applies a y-move onto a layout that changed on disk', async () => {
        await s.api.updateTimelineLayout({ version: '', chapters: { wedding: { y: 5 } }, triggers: {} });
        await s.store.commitChapter('village', { y: 40 });
        expect((await s.api.getTimelineLayout()).chapters).toEqual({ wedding: { y: 5 }, village: { y: 40 } });
    });

    it('on a stale chapter save takes the file version and tells the user', async () => {
        await s.api.updateChapter('village', {
            version: (await s.api.getChapter('village')).version,
            title: 'Changed elsewhere',
        });
        await s.store.commitChapter('village', { start: VILLAGE_START + HOUR_S, end: VILLAGE_END + HOUR_S });
        expect(s.deps.notify).toHaveBeenCalledWith(expect.stringContaining('changed on disk'), 'warning');
        expect(s.store.chapters.get('village')?.title).toBe('Changed elsewhere');
        expect(s.store.chapterRange('village')).toEqual({ start: VILLAGE_START, end: VILLAGE_END });
    });

    it('moves a trigger in time', async () => {
        await s.store.commitTrigger('nobleHouseRobbery', 3 * DAY_S);
        expect((await s.api.getTrigger('nobleHouseRobbery')).time).toBe('4.1. 0:00');
    });

    it('delete asks first, and does nothing when cancelled', async () => {
        s.store.select({ kind: 'chapter', id: 'wedding' });
        s.deps.confirm.mockResolvedValueOnce(false);
        expect(await s.store.deleteSelected()).toBe(false);
        expect(s.deps.confirm).toHaveBeenCalledWith(expect.objectContaining({ danger: true }));
        await expect(s.api.getChapter('wedding')).resolves.toBeTruthy();

        expect(await s.store.deleteSelected()).toBe(true);
        await expect(s.api.getChapter('wedding')).rejects.toBeInstanceOf(ApiError);
        expect(s.store.chapters.has('wedding')).toBe(false);
        expect(s.store.selected).toBeNull();
    });

    it('delete shows the references on 409 referenced', async () => {
        const references = [
            { file: 'data/chapters/kingdom/annie.passages/x.ts', line: 3, passageId: 'kingdom-annie-x' },
        ];
        vi.spyOn(s.api, 'deleteChapter').mockRejectedValueOnce(new ApiError(409, { error: 'referenced', references }));
        s.store.select({ kind: 'chapter', id: 'village' });
        expect(await s.store.deleteSelected()).toBe(false);
        expect(s.deps.showReferences).toHaveBeenCalledWith(expect.any(String), references);
        expect(s.store.chapters.has('village')).toBe(true);
    });

    it('deletes a trigger', async () => {
        s.store.select({ kind: 'trigger', id: 'nobleHouseRobbery' });
        expect(await s.store.deleteSelected()).toBe(true);
        expect(s.store.triggers.has('nobleHouseRobbery')).toBe(false);
    });

    it('refetches only the changed resource on a live event', async () => {
        const getChapter = vi.spyOn(s.api, 'getChapter');
        s.api.simulateExternalChange('chapter', 'kingdom');
        await flush();
        await flush();
        expect(getChapter).toHaveBeenCalledTimes(1);
        expect(getChapter).toHaveBeenCalledWith('kingdom');
        expect(s.store.chapters.get('kingdom')?.version).toBe((await s.api.getChapter('kingdom')).version);
    });

    it('ignores the echo of its own saves', async () => {
        const getChapter = vi.spyOn(s.api, 'getChapter');
        await s.store.commitChapter('village', { start: VILLAGE_START + HOUR_S, end: VILLAGE_END + HOUR_S });
        await flush();
        expect(getChapter).not.toHaveBeenCalled();
    });

    it('picks up a chapter created elsewhere', async () => {
        await s.api.createChapter({
            chapterId: 'harbor',
            title: 'Harbor',
            location: 'village',
            timeRange: { start: '6.1. 8:00', end: '7.1. 8:00' },
        });
        // the mock marks its own writes as saved, so dispatch the event as the server would for a hand edit
        s.events.dispatch({ kind: 'chapter', id: 'harbor', version: 'external', op: 'created' });
        await vi.waitFor(() => expect(s.store.chapters.has('harbor')).toBe(true));
        expect(s.store.chapterIds).toContain('harbor');
    });

    it('filters chapters by character', () => {
        s.store.setCharacter('annie');
        expect(s.store.isChapterVisible('kingdom')).toBe(true);
        expect(s.store.isChapterVisible('village')).toBe(false);
        s.store.setCharacter(null);
        expect(s.store.isChapterVisible('village')).toBe(true);
    });

    it('creates a chapter and a trigger from "Add"', async () => {
        await s.store.createChapter({ chapterId: 'harbor', location: 'village', start: 10 * DAY_S });
        expect((await s.api.getChapter('harbor')).timeRange).toEqual({ start: '11.1. 0:00', end: '12.1. 0:00' });
        expect(s.store.selected).toEqual({ kind: 'chapter', id: 'harbor' });
        await s.store.createTrigger({ chapterId: 'harbor', triggerId: 'storm', time: 10 * DAY_S + HOUR_S });
        expect((await s.api.getTrigger('storm')).time).toBe('11.1. 1:00');
        expect(s.store.triggers.has('storm')).toBe(true);
    });
});

describe('TimelineView', () => {
    let s: TSetup;
    let canvas: HTMLCanvasElement;
    let view: TimelineView;

    beforeEach(async () => {
        installFrames();
        s = await setup();
        canvas = createCanvas(1000, 600);
        view = new TimelineView(canvas, s.store, { timeManager: new TimeManager() });
    });

    afterEach(() => {
        view.destroy();
        canvas.remove();
        s.store.dispose();
        uninstallFrames();
    });

    const screenRect = (kind: 'chapter' | 'trigger', id: string) => {
        const b = view.shapeOf(kind, id)!.getBounds();
        const p = view.camera.worldToScreen(b);
        return { x: p.x, y: p.y, width: b.width, height: b.height };
    };

    it('places chapter boxes by time range and layout y', () => {
        const village = view.shapeOf('chapter', 'village')!.getBounds();
        expect(village.x).toBeCloseTo(s.store.timeToX(VILLAGE_START));
        expect(village.width).toBeCloseTo(s.store.timeToX(VILLAGE_END) - s.store.timeToX(VILLAGE_START));
        expect(view.shapeOf('chapter', 'kingdom')!.getBounds().y).toBe(70);
    });

    it('dragging the selected chapter saves the shifted time range', async () => {
        const r = screenRect('chapter', 'village');
        const at: [number, number] = [r.x + 40, r.y + 20];
        click(canvas, ...at);
        expect(s.store.selected).toEqual({ kind: 'chapter', id: 'village' });
        const dx = 14 * HOUR_S * s.store.pps; // 14 hours to the right
        drag(canvas, at, [at[0] + dx, at[1]]);
        await vi.waitFor(async () =>
            expect((await s.api.getChapter('village')).timeRange).toEqual({ start: '2.1. 22:00', end: '5.1. 22:00' })
        );
        expect((await s.api.getTimelineLayout()).chapters.village).toBeUndefined();
    });

    it('dragging the right edge resizes, a vertical drag saves y', async () => {
        const r = screenRect('chapter', 'village');
        click(canvas, r.x + 40, r.y + 20);
        const right: [number, number] = [r.x + r.width, r.y + 20];
        drag(canvas, right, [right[0] + 7 * HOUR_S * s.store.pps, right[1]]);
        await vi.waitFor(async () =>
            expect((await s.api.getChapter('village')).timeRange).toEqual({ start: '2.1. 8:00', end: '5.1. 15:00' })
        );

        const r2 = screenRect('chapter', 'village');
        drag(canvas, [r2.x + 40, r2.y + 20], [r2.x + 40, r2.y + 220]);
        await vi.waitFor(async () => expect((await s.api.getTimelineLayout()).chapters.village).toEqual({ y: 200 }));
        expect((await s.api.getChapter('village')).timeRange).toEqual({ start: '2.1. 8:00', end: '5.1. 15:00' });
    });

    it('dragging an unselected chapter pans instead of saving', async () => {
        const update = vi.spyOn(s.api, 'updateChapter');
        const r = screenRect('chapter', 'village');
        const x0 = view.camera.x;
        drag(canvas, [r.x + 40, r.y + 20], [r.x + 140, r.y + 20]);
        await flush();
        expect(view.camera.x).toBeCloseTo(x0 - 100);
        expect(update).not.toHaveBeenCalled();
    });

    it('dragging on the strip pans in time only', () => {
        const { x, y } = view.camera;
        const stripY = 600 - STRIP_HEIGHT / 2;
        drag(canvas, [500, stripY], [400, stripY + 30]);
        expect(view.camera.x).toBeCloseTo(x + 100);
        expect(view.camera.y).toBe(y);
    });

    it('the wheel zooms time around the cursor', () => {
        const sx = 300;
        const t = s.store.xToTime(view.camera.x + sx);
        fire(canvas, 'pointermove', sx, 200, { buttons: 0 });
        canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: -200, clientX: sx, clientY: 200, cancelable: true }));
        expect(s.store.pps).toBeGreaterThan(DEFAULT_PX_PER_SECOND);
        expect(s.store.xToTime(view.camera.x + sx)).toBeCloseTo(t, 0);
        // shapes follow the new scale
        expect(view.shapeOf('chapter', 'village')!.getBounds().x).toBeCloseTo(s.store.timeToX(VILLAGE_START));
    });

    it('selects and drags a trigger along the strip, double-click opens chapters', async () => {
        // bring the trigger into view
        view.camera.set({ x: s.store.timeToX(s.store.triggerTime('nobleHouseRobbery')!) - 500 });
        const trigger = view.shapeOf('trigger', 'nobleHouseRobbery')!;
        const p = view.camera.worldToScreen(trigger.getOrigin());
        click(canvas, p.x, p.y);
        expect(s.store.selected).toEqual({ kind: 'trigger', id: 'nobleHouseRobbery' });
        drag(canvas, [p.x, p.y], [p.x + DAY_S * s.store.pps, p.y - 50]);
        await vi.waitFor(async () => expect((await s.api.getTrigger('nobleHouseRobbery')).time).toBe('2.12. 0:00'));

        view.camera.set({ x: s.store.timeToX(VILLAGE_START) - 100 });
        const r = screenRect('chapter', 'wedding');
        fire(canvas, 'dblclick', r.x + 10, r.y + 10);
        expect(s.deps.openChapter).toHaveBeenCalledWith('wedding');
    });

    it('hides triggers and filtered chapters, and follows live changes', async () => {
        s.store.toggleTriggers();
        expect(view.shapeOf('trigger', 'nobleHouseRobbery')!.visible).toBe(false);
        s.store.setCharacter('annie');
        expect(view.shapeOf('chapter', 'village')!.visible).toBe(false);
        expect(view.shapeOf('chapter', 'kingdom')!.visible).toBe(true);

        const chapter = await s.api.getChapter('wedding');
        await s.api.updateChapter('wedding', {
            version: chapter.version,
            timeRange: { start: '10.1. 8:00', end: '11.1. 8:00' },
        });
        s.events.dispatch({ kind: 'chapter', id: 'wedding', version: 'external', op: 'updated' });
        await vi.waitFor(() =>
            expect(view.shapeOf('chapter', 'wedding')!.getBounds().x).toBeCloseTo(
                s.store.timeToX(parseTime('10.1. 8:00')!)
            )
        );
    });
});
