import {
    BoxObject,
    EdgeObject,
    History,
    Keyboard,
    LeftToRightLayout,
    Navigation,
    Scene,
    SelectTool,
    Selection,
    Snapping,
    SpringForceLayout,
    ToolManager,
    type ILayoutGraph,
    type ILayoutNode,
} from '@story/canvas';
import { showToast, type TPoint } from '@story/shared';
import { action, computed, makeObservable, observable, runInAction } from 'mobx';
import type { TChapterSummary, TPassageSummary } from '../../../server/src/story/types';
import type { Agent } from '../stores/Agent';

/**
 * The chapter view's passage graph (VISUALIZER_PLAN §7, Phase 7).
 *
 * ## What this replaces, and why it is so much smaller
 *
 * The graph used to be ~25 files under `GUIComponents/Graphs/ChapterPassagesGraph/**`: an
 * actualizer, per-passage-type node and edge creator hierarchies, six resolvers, a serializer
 * and deserializer, and a `createWorldState` call — because the only way to find out what a
 * passage linked to was to *evaluate* it against a world state, in the browser.
 *
 * The server answers that question now. `GET /api/chapter/:id/passages` returns each passage
 * with its `linkedPassageIds` already resolved by static analysis (`PassageIndexer`), so this
 * store's job is reduced to what it should always have been: turn a list of nodes and edges
 * into scene objects, lay them out, and let the author move them.
 *
 * The static link graph is **approximate** in a specific, documented way — it reports every
 * link that appears as a literal anywhere in the passage, including branches the player can
 * never reach. For a graph *view* that is the better failure: an edge that exists in the source
 * but not in play is useful to see, and one that is missing is not.
 *
 * ## Positions
 *
 * Saved to `TChapter.layout` through `PUT /api/chapter/:id/layout` (§4.4), replacing the
 * `localStorage` the old graph used — which was per-browser, not per-story, and invisible to
 * git. A chapter with no saved layout gets one from `@story/canvas`'s layout algorithms; once
 * the author moves anything, their positions win and the layout is not re-run.
 */

/** Scene-object meta key linking a box back to its passage. */
const META_PASSAGE = 'passageId';

const NODE_SIZE = { width: 180, height: 64 };

/** Colour per passage type, so the shape of a chapter is readable before reading any text. */
const TYPE_COLORS: Record<TPassageSummary['type'], string> = {
    screen: '#26344a',
    linear: '#2f4436',
    transition: '#4a3a26',
    unknown: '#3a3a3a',
};

export class PassageGraphStore {
    /* -------------------------------------------------------------- observable */

    passages: TPassageSummary[] = [];
    chapter: TChapterSummary | null = null;
    loading = true;
    error: string | null = null;
    saving = false;
    /** True once the author has moved something that is not yet written to `data/`. */
    layoutDirty = false;
    selectedPassageId: string | null = null;
    /** Whether the live force layout is running. */
    animating = false;

    /* ---------------------------------------------------------- non-observable */

    private scene: Scene | null = null;
    private readonly selection = new Selection();
    private readonly history = new History();
    private tools: ToolManager | null = null;
    private navigation: Navigation | null = null;
    private keyboard: Keyboard | null = null;
    private disposers: (() => void)[] = [];

    private readonly boxes = new Map<string, BoxObject>();
    private chapterHash: string | null = null;
    private frame: number | null = null;
    private readonly liveLayout = new SpringForceLayout();
    /**
     * Set while the *initial* arrangement runs.
     *
     * Laying a chapter out on first open moves every box, which the change handler would
     * otherwise read as an edit — so opening a chapter nobody had touched announced "unsaved
     * positions". The arrangement is a suggestion until the author moves something; saving it
     * is still possible, because the save button is enabled whenever there is a layout to write.
     */
    private suppressDirty = false;

    constructor(
        private readonly agent: Agent,
        readonly chapterId: string,
        /** Called on double-click — the host opens the passage in the author's editor. */
        private readonly onOpenPassage: (passage: TPassageSummary) => void
    ) {
        makeObservable(this, {
            passages: observable.ref,
            chapter: observable.ref,
            loading: observable,
            error: observable,
            saving: observable,
            layoutDirty: observable,
            selectedPassageId: observable,
            animating: observable,
            selectedPassage: computed,
            canSave: computed,
            setAnimating: action,
        });
    }

    get selectedPassage(): TPassageSummary | undefined {
        return this.passages.find((passage) => passage.id === this.selectedPassageId);
    }

    /* ------------------------------------------------------------------ load */

    load = async (): Promise<void> => {
        runInAction(() => {
            this.loading = true;
            this.error = null;
        });

        try {
            const [chapter, passages] = await Promise.all([
                this.agent.getChapter(this.chapterId),
                this.agent.getChapterPassages(this.chapterId),
            ]);

            runInAction(() => {
                this.chapter = chapter;
                this.chapterHash = chapter.hash;
                this.passages = passages;
                this.loading = false;
            });

            if (this.scene) this.rebuild();
        } catch (caught) {
            runInAction(() => {
                this.error = caught instanceof Error ? caught.message : _('Could not load the chapter');
                this.loading = false;
            });
        }
    };

    /* --------------------------------------------------------------- mounting */

    attach = (scene: Scene): (() => void) => {
        this.scene = scene;

        this.navigation = new Navigation(scene);
        this.keyboard = new Keyboard(scene, {
            onUndo: () => this.history.undo(),
            onRedo: () => this.history.redo(),
        });

        const selectTool = new SelectTool({
            // Edges follow their endpoints, so selecting one is not useful and dragging one is
            // meaningless. Restricting the tool is cheaper than making `EdgeObject` unselectable
            // and then wondering why marquee selection skips it.
            filter: (object) => object instanceof BoxObject,
            moveLabel: _('Move passage'),
        });

        this.tools = new ToolManager({
            scene,
            selection: this.selection,
            history: this.history,
            snapping: new Snapping({ gridSize: 0, vertexThreshold: 0 }),
            navigation: this.navigation,
        });
        this.tools.register(selectTool);

        this.track(this.selection.onChange, ({ selected }) => {
            const box = selected.find((object): object is BoxObject => object instanceof BoxObject);
            runInAction(() => {
                this.selectedPassageId = box?.getMeta<string>(META_PASSAGE) ?? null;
            });
        });

        this.track(selectTool.onOpen, ({ object }) => {
            const passageId = object.getMeta<string>(META_PASSAGE);
            const passage = this.passages.find((candidate) => candidate.id === passageId);
            if (passage) this.onOpenPassage(passage);
        });

        // A moved box is an unsaved layout. Filtering on `position` rather than accepting every
        // change keeps a selection highlight from marking the chapter dirty.
        this.track(scene.onObjectChanged, ({ object, property }) => {
            if (property !== 'position') return;
            if (!(object instanceof BoxObject)) return;
            if (this.suppressDirty) return;
            runInAction(() => (this.layoutDirty = true));
        });

        if (!this.loading) this.rebuild();

        return this.detach;
    };

    private detach = (): void => {
        this.stopAnimation();
        for (const dispose of this.disposers) dispose();
        this.disposers = [];
        this.tools?.destroy();
        this.keyboard?.destroy();
        this.navigation?.destroy();
        this.tools = null;
        this.keyboard = null;
        this.navigation = null;
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

    /** Rebuilds every scene object from the loaded passages. */
    private rebuild(): void {
        const scene = this.scene;
        if (!scene) return;

        scene.clear();
        this.boxes.clear();

        const saved = this.chapter?.layout ?? {};
        const hasSavedLayout = Object.keys(saved).length > 0;

        this.passages.forEach((passage, index) => {
            const position = saved[passage.id] ?? seedPosition(index);
            const box = new BoxObject({
                id: `passage-${passage.id}`,
                position: { ...position },
                size: { ...NODE_SIZE },
                title: passage.title ?? passage.localId,
                subtitle: `${passage.characterId} · ${passage.type}`,
                color: TYPE_COLORS[passage.type],
                meta: { [META_PASSAGE]: passage.id },
            });
            this.boxes.set(passage.id, box);
            scene.add(box);
        });

        // Edges after the boxes, so an edge can resolve both of its endpoints.
        for (const passage of this.passages) {
            const source = this.boxes.get(passage.id);
            if (!source) continue;

            for (const targetId of passage.linkedPassageIds) {
                const target = this.boxes.get(targetId);
                // A link out of the chapter is real and common (an ending points at the next
                // chapter's first passage). It is not drawn, because the node is not here —
                // the panel lists it instead.
                if (!target) continue;

                scene.add(
                    new EdgeObject({
                        id: `edge-${passage.id}->${targetId}`,
                        source,
                        target,
                        // Below the boxes: an arrow drawn over a node hides its title.
                        z: -1,
                    })
                );
            }
        }

        if (!hasSavedLayout && this.passages.length > 0) {
            // No author layout yet: run one so the chapter is readable on first open. The
            // result is *not* marked dirty — it is a suggestion until the author moves
            // something, and auto-saving it would write a layout nobody asked for.
            this.suppressDirty = true;
            try {
                this.runLayout(false);
            } finally {
                this.suppressDirty = false;
            }
        }

        this.fitWhenSettled();
    }

    /**
     * Fits on the next frame, after re-reading the container's size.
     *
     * Fitting immediately framed the graph against a stale viewport: the canvas mounts inside a
     * resizable splitter whose panes are laid out by the browser *after* React commits, so the
     * size the scene had at `attach` time was not the size it ended up with — and a fit computed
     * against the wrong extent leaves the content jammed into a corner, which is exactly what
     * it did.
     */
    private fitWhenSettled(): void {
        requestAnimationFrame(() => {
            if (!this.scene) return;
            this.scene.syncSize();
            this.scene.fitToContent(80);
        });
    }

    /* ---------------------------------------------------------------- layout */

    /** The structural view of the scene that `@story/canvas`'s layouts operate on. */
    private layoutGraph(): ILayoutGraph {
        const nodes: ILayoutNode[] = [...this.boxes.entries()].map(([passageId, box]) => ({
            id: passageId,
            get position() {
                return box.position;
            },
            set position(value: TPoint) {
                box.position = value;
            },
            size: box.size,
            pinned: box.selected,
        }));

        const edges = this.passages.flatMap((passage) =>
            passage.linkedPassageIds
                .filter((target) => this.boxes.has(target))
                .map((target) => ({ id: `${passage.id}->${target}`, source: passage.id, target }))
        );

        return { nodes, edges };
    }

    /**
     * One-shot tidy-up: strongly-connected components, left to right.
     *
     * Not Kamada–Kawai, and the reason is what a *passage* graph is. A chapter is mostly a DAG
     * with the occasional loop back to a hub passage, and the thing an author wants to see is
     * reading order — which is exactly what the SCC levelling produces. An energy model instead
     * optimises for even edge lengths, and on a three-node chapter that has a degenerate
     * minimum: measured on this story, it stacked all three passages in a column at the left
     * edge with two of them overlapping.
     *
     * The energy layouts are still there and still tested; they are the right tool for a dense
     * graph, which a chapter is not.
     */
    runLayout = (markDirty = true): void => {
        if (!this.scene || this.boxes.size === 0) return;

        const bounds = {
            width: Math.max(800, this.scene.viewport.size.width),
            height: Math.max(600, this.scene.viewport.size.height),
        };

        new LeftToRightLayout().initialize(this.layoutGraph(), bounds);

        this.fitWhenSettled();
        if (markDirty) runInAction(() => (this.layoutDirty = true));
    };

    /**
     * The live force layout, one step per frame.
     *
     * Off by default. The old graph ran it permanently, which meant the passages drifted while
     * the author was reading them and a position was never stable enough to be worth saving —
     * which is part of why positions lived in `localStorage` rather than in the story.
     */
    setAnimating = (animating: boolean): void => {
        this.animating = animating;
        if (animating) this.startAnimation();
        else this.stopAnimation();
    };

    private startAnimation(): void {
        if (this.frame !== null || !this.scene) return;

        const step = () => {
            if (!this.scene) return;
            const bounds = {
                width: Math.max(800, this.scene.viewport.size.width),
                height: Math.max(600, this.scene.viewport.size.height),
            };
            this.liveLayout.step(this.layoutGraph(), bounds);
            this.frame = requestAnimationFrame(step);
        };

        this.frame = requestAnimationFrame(step);
        runInAction(() => (this.layoutDirty = true));
    }

    private stopAnimation(): void {
        if (this.frame === null) return;
        cancelAnimationFrame(this.frame);
        this.frame = null;
    }

    fit = (): void => {
        this.scene?.syncSize();
        this.scene?.fitToContent(80);
    };

    /* ------------------------------------------------------------------ save */

    /**
     * True when there is a layout worth writing — the save button's enablement.
     *
     * Derived from `passages`, not from `this.boxes.size`. `boxes` is a plain `Map` that mobx
     * cannot observe, so a `computed` over it is evaluated once — while it is still empty — and
     * never recomputed, which left the save button permanently disabled. `passages` is
     * `observable.ref` and there is one box per passage, so it answers the same question and
     * actually invalidates.
     */
    get canSave(): boolean {
        return !this.saving && this.passages.length > 0;
    }

    /** Writes the current positions to `TChapter.layout` (§4.4). */
    saveLayout = async (): Promise<void> => {
        if (!this.canSave) return;
        runInAction(() => (this.saving = true));

        try {
            const layout: Record<string, TPoint> = {};
            for (const [passageId, box] of this.boxes) {
                layout[passageId] = { x: Math.round(box.position.x), y: Math.round(box.position.y) };
            }

            const updated = await this.agent.updateChapterLayout(this.chapterId, layout, this.chapterHash ?? undefined);
            this.chapterHash = updated.hash;

            runInAction(() => {
                this.chapter = updated;
                this.layoutDirty = false;
            });
            showToast(_('Passage positions saved'), { variant: 'success' });
        } catch (caught) {
            showToast(caught instanceof Error ? caught.message : _('Could not save the layout'), { variant: 'error' });
        } finally {
            runInAction(() => (this.saving = false));
        }
    };

    /** `DELETE /api/passage/:type/:id`, then reload so the graph matches the files. */
    deleteSelectedPassage = async (): Promise<void> => {
        const passage = this.selectedPassage;
        if (!passage) return;

        try {
            const result = await this.agent.deletePassageTyped(passage.id, passage.type);
            if (result.referencedBy.length > 0) {
                // Reported rather than refused by the server: a dangling passage link still
                // typechecks, so this is the author's call — but it should not be a surprise.
                showToast(_('Deleted. Still linked from: %s', result.referencedBy.join(', ')), { variant: 'warning' });
            } else {
                showToast(_('Passage %s deleted', passage.id), { variant: 'success' });
            }
            await this.load();
        } catch (caught) {
            showToast(caught instanceof Error ? caught.message : _('Could not delete the passage'), {
                variant: 'error',
            });
        }
    };
}

/**
 * Where a passage starts before anything has laid it out.
 *
 * A diagonal rather than a grid or a single point: the layouts below all divide by the distance
 * between nodes, and a pile of nodes at one coordinate makes that a division by zero. A spread
 * gives them somewhere to push apart from.
 */
const seedPosition = (index: number): TPoint => ({
    x: 120 + (index % 6) * 240,
    y: 120 + Math.floor(index / 6) * 160 + (index % 3) * 20,
});
