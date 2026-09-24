import {
    BoxObject,
    EdgeObject,
    History,
    Navigation,
    Scene,
    SelectTool,
    Selection,
    Snapping,
    ToolManager,
    type TPointerEvent,
} from '@story/canvas';
import { DAY_S, HOUR_S, showToast, Time, type TimeManager } from '@story/shared';
import { action, computed, makeObservable, observable, runInAction } from 'mobx';
import type { TChapterSummary, TPassageSummary, TStoryIndex } from '../../../../server/src/story/types';
import type { Agent } from '../../stores/Agent';
import { TimeAxisObject } from './TimeAxisObject';

/**
 * The world-events timeline (VISUALIZER_PLAN §7, Phase 8).
 *
 * ## The coordinate system *is* the simplification
 *
 * World **x is seconds** and world **y is rows**. A chapter box is placed at
 * `(timeRange.start.s, row × ROW_HEIGHT)` and sized `(duration.s, ROW_HEIGHT − gap)`; zooming
 * time is then nothing but `Viewport.pixelSize.width`, and the rows keep a fixed pixel height
 * because `pixelSize.height` stays at 1. That is what §7 means by "anisotropic zoom is
 * `Viewport`'s, from Phase 1" — the whole of `DurationHelper`, `ZOOM_CONFIG`'s five discrete
 * steps, `TimelineRender`, `TimelinePaint`, `TimelineDraw`, `TimelineMouseListener` and
 * `TimelineMarker` collapse into a viewport and one axis object.
 *
 * Dragging a chapter therefore *is* changing its time: the box's world x is the start time in
 * seconds, so a drop is a `POST /api/chapter/:id/setTime` with the new x.
 *
 * ## Rows
 *
 * Chapters are grouped by location and packed into rows so that two overlapping chapters in the
 * same location never share one — the same rule the old timeline had, kept because it is what
 * makes a busy timeline readable. Recomputed on every change, because a drag can change whether
 * two chapters overlap.
 */

const META_CHAPTER = 'chapterId';
const META_TRIGGER = 'triggerId';

/** World units per row. A chapter box is this tall minus the gap. */
const ROW_HEIGHT = 56;
const ROW_GAP = 10;
/** World y of the first row. Leaves room for the axis above it. */
const TOP_MARGIN = 40;

/** Seconds per pixel at the extremes — a decade across, or a couple of minutes. */
const MIN_SECONDS_PER_PIXEL = 1;
const MAX_SECONDS_PER_PIXEL = 4 * 365 * DAY_S;

/** Stable colour per location, so a location keeps its colour across reloads. */
const LOCATION_COLORS = ['#2e6f56', '#3a5a8c', '#7a5230', '#6b3f6e', '#4a6b2e', '#8c4a4a'];

export class TimelineStore {
    /* -------------------------------------------------------------- observable */

    chapters: TChapterSummary[] = [];
    passages: TPassageSummary[] = [];
    characters: TStoryIndex['characters'] = [];
    loading = true;
    error: string | null = null;

    /** README: "chapters per character, character selector". `null` shows every chapter. */
    characterFilter: string | null = null;
    /** README: "connections toggle". */
    showConnections = true;
    /** README: "time-trigger toggle". */
    showTriggers = true;
    /** The chapter under the cursor, for the hover description. */
    hoveredChapterId: string | null = null;
    hoverAt: { x: number; y: number } | null = null;
    selectedChapterId: string | null = null;
    saving = false;

    /* ---------------------------------------------------------- non-observable */

    private scene: Scene | null = null;
    private readonly selection = new Selection();
    private readonly history = new History();
    private tools: ToolManager | null = null;
    private navigation: Navigation | null = null;
    private axis: TimeAxisObject | null = null;
    private disposers: (() => void)[] = [];

    private readonly boxes = new Map<string, BoxObject>();
    private readonly hashes = new Map<string, string | null>();
    /** Where a drag started, so a drop can be reported as a time change or ignored. */
    private dragStartSeconds: number | null = null;

    constructor(
        private readonly agent: Agent,
        private readonly timeManager: TimeManager,
        private readonly onOpenChapter: (chapterId: string) => void,
        private readonly onOpenTrigger: (chapterId: string, triggerId: string) => void
    ) {
        makeObservable(this, {
            chapters: observable.ref,
            passages: observable.ref,
            characters: observable.ref,
            loading: observable,
            error: observable,
            characterFilter: observable,
            showConnections: observable,
            showTriggers: observable,
            hoveredChapterId: observable,
            hoverAt: observable.ref,
            selectedChapterId: observable,
            saving: observable,

            visibleChapters: computed,
            hoveredChapter: computed,
            selectedChapter: computed,

            setCharacterFilter: action,
            toggleConnections: action,
            toggleTriggers: action,
        });
    }

    /**
     * Chapters the selected character appears in.
     *
     * A chapter has no character of its own — its *passages* do — so "this character's chapters"
     * means the chapters that contain at least one passage for them. That is the only reading of
     * README's "chapters per character" the data supports, and it is the useful one: it answers
     * "where in the story does Annie appear?".
     */
    get visibleChapters(): TChapterSummary[] {
        if (this.characterFilter === null) return this.chapters;

        const withCharacter = new Set(
            this.passages
                .filter((passage) => passage.characterId === this.characterFilter)
                .map((passage) => passage.chapterId)
        );
        return this.chapters.filter((chapter) => withCharacter.has(chapter.id));
    }

    get hoveredChapter(): TChapterSummary | undefined {
        return this.chapters.find((chapter) => chapter.id === this.hoveredChapterId);
    }

    get selectedChapter(): TChapterSummary | undefined {
        return this.chapters.find((chapter) => chapter.id === this.selectedChapterId);
    }

    /* ------------------------------------------------------------------ load */

    load = async (): Promise<void> => {
        runInAction(() => {
            this.loading = true;
            this.error = null;
        });

        try {
            const story = await this.agent.getStory();
            runInAction(() => {
                this.chapters = story.chapters;
                this.passages = story.passages;
                this.characters = story.characters;
                this.loading = false;
            });
            for (const chapter of story.chapters) this.hashes.set(chapter.id, chapter.hash);

            if (this.scene) this.rebuild();
        } catch (caught) {
            runInAction(() => {
                this.error = caught instanceof Error ? caught.message : _('Could not load the story');
                this.loading = false;
            });
        }
    };

    /* --------------------------------------------------------------- mounting */

    attach = (scene: Scene): (() => void) => {
        this.scene = scene;

        // Time zooms; rows do not. This is the anisotropic case `Viewport` exists for.
        scene.viewport.set({ pixelSize: { width: HOUR_S / 4, height: 1 } });

        this.navigation = new Navigation(scene, {
            // Left-drag pans — README: "timeline: drag to move the timeline". A chapter box
            // under the cursor takes the drag instead; `SelectTool` sees the event first.
            panButtons: [1, 2],
            zoomAxis: 'x',
            zoomStep: 1.2,
        });

        const selectTool = new SelectTool({
            filter: (object) => object instanceof BoxObject,
            moveLabel: _('Move chapter'),
        });

        this.tools = new ToolManager({
            scene,
            selection: this.selection,
            history: this.history,
            snapping: new Snapping({ gridSize: 0, vertexThreshold: 0 }),
            navigation: this.navigation,
        });
        this.tools.register(selectTool);

        this.axis = new TimeAxisObject({
            id: 'time-axis',
            viewport: scene.viewport,
            timeManager: this.timeManager,
            y: TOP_MARGIN - 16,
        });
        scene.add(this.axis);

        this.track(this.selection.onChange, ({ selected }) => {
            const box = selected.find((object): object is BoxObject => object instanceof BoxObject);
            runInAction(() => (this.selectedChapterId = box?.getMeta<string>(META_CHAPTER) ?? null));
        });

        this.track(selectTool.onOpen, ({ object }) => {
            const triggerId = object.getMeta<string>(META_TRIGGER);
            const chapterId = object.getMeta<string>(META_CHAPTER);
            if (!chapterId) return;
            // README: "time-trigger toggle, double-click → trigger view".
            if (triggerId) this.onOpenTrigger(chapterId, triggerId);
            else this.onOpenChapter(chapterId);
        });

        // Hover description — README: "description on hover".
        this.track(scene.onPointer, (event: TPointerEvent) => {
            if (event.type !== 'move') return;
            const hit = scene.hitTest(event.world, (object) => object instanceof BoxObject);
            const chapterId = hit?.getMeta<string>(META_CHAPTER) ?? null;
            if (chapterId === this.hoveredChapterId) return;
            runInAction(() => {
                this.hoveredChapterId = chapterId;
                this.hoverAt = chapterId ? { x: event.screen.x, y: event.screen.y } : null;
            });
        });

        // A drag changes a chapter's time, so the drop has to be caught and written.
        this.track(scene.onPointer, (event: TPointerEvent) => {
            if (event.type === 'down') {
                const hit = scene.hitTest(event.world, (object) => object instanceof BoxObject);
                this.dragStartSeconds = hit instanceof BoxObject ? hit.position.x : null;
                return;
            }
            if (event.type !== 'up' || this.dragStartSeconds === null) return;

            const box = this.selection.single;
            const start = this.dragStartSeconds;
            this.dragStartSeconds = null;
            if (!(box instanceof BoxObject)) return;
            if (Math.round(box.position.x) === Math.round(start)) return;
            void this.commitTime(box);
        });

        if (!this.loading) this.rebuild();

        return this.detach;
    };

    private detach = (): void => {
        for (const dispose of this.disposers) dispose();
        this.disposers = [];
        this.tools?.destroy();
        this.navigation?.destroy();
        this.tools = null;
        this.navigation = null;
        this.axis = null;
        this.scene = null;
        this.boxes.clear();
    };

    private track<T>(
        observer: { subscribe: (fn: (value: T) => void) => void; unsubscribe: (fn: (value: T) => void) => void },
        handler: (value: T) => void
    ): void {
        observer.subscribe(handler);
        this.disposers.push(() => observer.unsubscribe(handler));
    }

    /* -------------------------------------------------------------- rendering */

    /** Rebuilds every scene object. Cheap for a story-sized chapter list. */
    private rebuild(): void {
        const scene = this.scene;
        if (!scene) return;

        scene.clear();
        this.boxes.clear();

        if (this.axis) scene.add(this.axis);

        const chapters = this.visibleChapters.filter((chapter) => chapter.timeRange !== null);
        const rows = packIntoRows(chapters);
        const colorOf = locationColors(chapters);

        for (const chapter of chapters) {
            const range = chapter.timeRange!;
            const row = rows.get(chapter.id) ?? 0;

            const box = new BoxObject({
                id: `chapter-${chapter.id}`,
                position: { x: range.start, y: TOP_MARGIN + row * ROW_HEIGHT },
                // Width *is* the duration, in seconds. A one-day chapter is 86 400 world units
                // wide and renders as however many pixels the current zoom makes that.
                size: { width: Math.max(1, range.end - range.start), height: ROW_HEIGHT - ROW_GAP },
                title: chapter.title,
                subtitle: chapter.locationId ?? undefined,
                color: colorOf(chapter.locationId),
                meta: { [META_CHAPTER]: chapter.id },
            });
            this.boxes.set(chapter.id, box);
            scene.add(box);
        }

        if (this.showConnections) {
            for (const chapter of chapters) {
                const source = this.boxes.get(chapter.id);
                if (!source) continue;
                for (const childId of chapter.childChapterIds) {
                    const target = this.boxes.get(childId);
                    if (!target) continue;
                    scene.add(
                        new EdgeObject({
                            id: `connection-${chapter.id}->${childId}`,
                            source,
                            target,
                            dashed: true,
                            z: -1,
                        })
                    );
                }
            }
        }

        if (this.showTriggers) {
            for (const chapter of chapters) {
                const box = this.boxes.get(chapter.id);
                if (!box) continue;

                chapter.triggerIds.forEach((triggerId, index) => {
                    // Spaced along the chapter rather than stacked at its start, so several
                    // triggers on one chapter stay individually clickable.
                    const fraction = (index + 1) / (chapter.triggerIds.length + 1);
                    const marker = new BoxObject({
                        id: `trigger-${triggerId}`,
                        position: {
                            x: box.position.x + box.size.width * fraction,
                            y: box.position.y - 6,
                        },
                        // Width in seconds so it scales with the zoom like everything else, but
                        // small enough to read as a marker rather than a block.
                        size: { width: Math.max(1, box.size.width * 0.02), height: 12 },
                        color: '#ffc300',
                        meta: { [META_CHAPTER]: chapter.id, [META_TRIGGER]: triggerId },
                        z: 2,
                    });
                    scene.add(marker);
                });
            }
        }

        this.fitWhenSettled();
    }

    /**
     * Frames the whole story after the container has settled.
     *
     * Deferred for the same reason as the passage graph's: the canvas lives inside a pane the
     * browser lays out after React commits, so fitting immediately frames against a stale size.
     */
    private fitWhenSettled(): void {
        requestAnimationFrame(() => {
            if (!this.scene) return;
            this.scene.syncSize();
            this.fit();
        });
    }

    /**
     * Fits the story's time range horizontally, keeping rows at their fixed pixel height.
     *
     * Not `Scene.fitToContent`, which is deliberately isotropic — using it here would scale the
     * rows by the same factor as the time axis and make a decade-long story's chapters one pixel
     * tall.
     */
    fit = (): void => {
        const scene = this.scene;
        if (!scene || this.boxes.size === 0) return;

        let min = Infinity;
        let max = -Infinity;
        for (const box of this.boxes.values()) {
            min = Math.min(min, box.position.x);
            max = Math.max(max, box.position.x + box.size.width);
        }
        if (!Number.isFinite(min) || max <= min) return;

        const padding = (max - min) * 0.05;
        const seconds = max - min + padding * 2;
        const width = Math.max(1, scene.viewport.size.width);

        scene.viewport.set({
            pixelSize: { width: clampSecondsPerPixel(seconds / width), height: 1 },
            position: { x: min - padding, y: 0 },
        });
    };

    /* ----------------------------------------------------------------- input */

    setCharacterFilter = (characterId: string | null): void => {
        this.characterFilter = characterId;
        this.rebuild();
    };

    toggleConnections = (): void => {
        this.showConnections = !this.showConnections;
        this.rebuild();
    };

    toggleTriggers = (): void => {
        this.showTriggers = !this.showTriggers;
        this.rebuild();
    };

    /** Zoom buttons. The wheel does the same through `Navigation`. */
    zoomBy = (factor: number): void => {
        this.scene?.viewport.zoomAtCenter({ width: factor, height: 1 });
    };

    /* ------------------------------------------------------------------ save */

    /**
     * Writes a dragged chapter's new time range.
     *
     * The duration is preserved — the box's width did not change, only its x — so a drag moves a
     * chapter in time rather than resizing it. Resizing is the box's edges, which `BoxObject`
     * does not offer and which the plan does not ask for.
     */
    private async commitTime(box: BoxObject): Promise<void> {
        const chapterId = box.getMeta<string>(META_CHAPTER);
        if (!chapterId) return;

        const start = Math.round(box.position.x);
        const end = Math.round(box.position.x + box.size.width);

        runInAction(() => (this.saving = true));
        try {
            const updated = await this.agent.setChapterTimeRange(
                chapterId,
                start,
                end,
                this.hashes.get(chapterId) ?? undefined
            );
            this.hashes.set(chapterId, updated.hash);

            runInAction(() => {
                this.chapters = this.chapters.map((chapter) =>
                    chapter.id === chapterId ? { ...chapter, timeRange: { start, end }, hash: updated.hash } : chapter
                );
            });
            showToast(_('%s moved to %s', updated.title, this.timeManager.renderTime(Time.fromS(start), 'dateTime')), {
                variant: 'success',
            });
            // Rows can change when a chapter stops overlapping its neighbour.
            this.rebuild();
        } catch (caught) {
            showToast(caught instanceof Error ? caught.message : _('Could not move the chapter'), {
                variant: 'error',
            });
            // Put it back: the file is the source of truth and the write did not happen.
            this.rebuild();
        } finally {
            runInAction(() => (this.saving = false));
        }
    }

    /** README: "timeline: add/delete chapter" — the delete half. */
    deleteSelectedChapter = async (): Promise<void> => {
        const chapter = this.selectedChapter;
        if (!chapter) return;

        try {
            await this.agent.deleteChapter(chapter.id);
            await this.load();
        } catch (caught) {
            showToast(caught instanceof Error ? caught.message : _('Could not delete the chapter'), {
                variant: 'error',
            });
        }
    };
}

const clampSecondsPerPixel = (value: number): number =>
    Math.min(MAX_SECONDS_PER_PIXEL, Math.max(MIN_SECONDS_PER_PIXEL, value));

/**
 * Packs chapters into rows so that two chapters that overlap in time never share one, grouped by
 * location — the rule the old timeline had, and the reason a busy timeline stays readable.
 *
 * Greedy first-fit over chapters sorted by start time, which is optimal for interval graphs:
 * the number of rows it uses equals the maximum number of simultaneously-running chapters, and
 * no packing can do better than that.
 */
const packIntoRows = (chapters: readonly TChapterSummary[]): Map<string, number> => {
    const byLocation = new Map<string, TChapterSummary[]>();
    for (const chapter of chapters) {
        const key = chapter.locationId ?? '';
        const list = byLocation.get(key);
        if (list) list.push(chapter);
        else byLocation.set(key, [chapter]);
    }

    const rows = new Map<string, number>();
    let nextFreeRow = 0;

    for (const group of [...byLocation.values()]) {
        const sorted = [...group].sort((a, b) => (a.timeRange?.start ?? 0) - (b.timeRange?.start ?? 0));
        // The end time occupying each row within this location's band.
        const rowEnds: number[] = [];

        for (const chapter of sorted) {
            const start = chapter.timeRange?.start ?? 0;
            const end = chapter.timeRange?.end ?? start;

            let row = rowEnds.findIndex((occupiedUntil) => occupiedUntil <= start);
            if (row === -1) {
                row = rowEnds.length;
                rowEnds.push(end);
            } else {
                rowEnds[row] = end;
            }
            rows.set(chapter.id, nextFreeRow + row);
        }

        nextFreeRow += rowEnds.length;
    }

    return rows;
};

/**
 * A stable colour per location.
 *
 * Indexed by the location's position in the sorted list rather than randomised, which is what
 * the old timeline did — a random colour per session meant the map and the timeline disagreed
 * about what colour a place was, every reload.
 */
const locationColors = (chapters: readonly TChapterSummary[]): ((locationId: string | null) => string) => {
    const locations = [...new Set(chapters.map((chapter) => chapter.locationId ?? ''))].sort();
    return (locationId) => {
        const index = locations.indexOf(locationId ?? '');
        return LOCATION_COLORS[(index < 0 ? 0 : index) % LOCATION_COLORS.length];
    };
};
