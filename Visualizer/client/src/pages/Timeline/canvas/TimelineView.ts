import { autorun, runInAction } from 'mobx';
import { Time, type TimeManager } from '@story/shared';
import type { TMaybeCode } from '@story/visualizer-protocol';
import {
    Camera,
    LineShape,
    RectShape,
    Scene,
    SelectionController,
    type ISceneInteraction,
    type Shape,
    type TSceneEvents,
} from '../../../canvas';
import { displayText } from '../../../api';
import { CHAPTER_HEIGHT, type TimelineStore } from '../store/TimelineStore';
import { snapStep, snapTime } from '../store/timeScale';
import { STRIP_HEIGHT, TimeStripShape, TRIGGER_DOT_OFFSET } from './TimeStripShape';
import { TriggerShape } from './TriggerShape';

export type TTimelineShapeData = { kind: 'chapter' | 'trigger'; id: string };

export type TTimelineTooltip = { title: string; lines: string[]; x: number; y: number } | null;

export type TTimelineViewOptions = {
    timeManager: TimeManager;
    onTooltip?: (tooltip: TTimelineTooltip) => void;
    onOpenTrigger?: (triggerId: string) => void;
    wheelSensitivity?: number;
};

const MIN_CHAPTER_WIDTH = 6;
const WHEEL_SENSITIVITY = 0.0015;

const timelineDataOf = (shape: Shape | null | undefined): TTimelineShapeData | null => {
    const data: unknown = shape?.data;
    if (typeof data !== 'object' || data === null || !('kind' in data) || !('id' in data)) return null;
    const { kind, id } = data;
    return (kind === 'chapter' || kind === 'trigger') && typeof id === 'string' ? { kind, id } : null;
};

export const locationColor = (location: TMaybeCode<string>) => {
    const key = typeof location === 'string' ? location : location.code;
    let hash = 0;
    for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
    return `hsl(${Math.abs(hash) % 360}, 40%, 34%)`;
};

export class TimelineView {
    readonly camera: Camera;
    readonly scene: Scene;
    readonly selection: SelectionController;
    readonly strip: TimeStripShape;

    private chapterShapes = new Map<string, RectShape<TTimelineShapeData>>();
    private triggerShapes = new Map<string, TriggerShape<TTimelineShapeData>>();
    private lines: LineShape[] = [];
    private dragging = false;
    private placed: boolean;
    private disposers: (() => void)[] = [];

    constructor(
        readonly canvas: HTMLCanvasElement,
        readonly store: TimelineStore,
        private readonly opts: TTimelineViewOptions
    ) {
        const saved = store.savedCamera;
        this.placed = saved !== null;
        this.camera = new Camera({ x: saved?.x ?? 0, y: saved?.y ?? -40, zoom: 1, minZoom: 1, maxZoom: 1 });
        this.scene = new Scene(canvas, { camera: this.camera, background: '#000', wheelZoom: false });
        this.selection = new SelectionController(this.scene);
        this.scene.layer('connections', 0);
        this.scene.layer('chapters', 1);
        this.scene.layer('strip', 10);
        this.scene.layer('triggers', 11);

        this.strip = this.scene.add(
            new TimeStripShape({
                getViewport: () => this.scene.size,
                getPps: () => this.store.pps,
                timeManager: opts.timeManager,
            }),
            'strip'
        );

        const onWheel = (e: WheelEvent) => this.handleWheel(e);
        const onLeave = () => this.setStripHover(null);
        canvas.addEventListener('wheel', onWheel, { passive: false });
        canvas.addEventListener('pointerleave', onLeave);

        this.disposers.push(
            () => canvas.removeEventListener('wheel', onWheel),
            () => canvas.removeEventListener('pointerleave', onLeave),
            this.scene.addInteraction(this.stripPan),
            this.scene.addDrawHook(this.drawGrid, 'before'),
            this.camera.subscribe((s) => this.store.saveCamera({ x: s.x, y: s.y })),
            this.scene.events.on('select', this.handleSelect),
            this.scene.events.on('change', this.handleChange),
            this.scene.events.on('pointermove', ({ shape, screen }) => this.showHoverTooltip(shape, screen)),
            this.scene.events.on('hover', ({ shape }) => {
                if (!shape) this.opts.onTooltip?.(null);
            }),
            autorun(() => this.sync())
        );
    }

    destroy(): void {
        for (const d of this.disposers.splice(0)) d();
        this.selection.destroy();
        this.scene.destroy();
    }

    zoomAt(sx: number, factor: number): void {
        const t = this.store.xToTime(this.camera.x + sx);
        const pps = this.store.setPps(this.store.pps * factor);
        this.camera.set({ x: t * pps - sx });
    }

    viewCenterTime(): number {
        return Math.max(0, this.store.xToTime(this.camera.x + this.scene.size.width / 2));
    }

    private handleWheel(e: WheelEvent): void {
        e.preventDefault();
        const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
        const delta = Math.max(-300, Math.min(300, e.deltaY * unit));
        if (delta === 0) return;
        const factor = Math.exp(-delta * (this.opts.wheelSensitivity ?? WHEEL_SENSITIVITY));
        const rect = this.canvas.getBoundingClientRect();
        this.zoomAt(e.clientX - rect.left, factor);
    }

    private inStrip(screenY: number): boolean {
        return screenY >= this.scene.size.height - STRIP_HEIGHT;
    }

    private setStripHover(x: number | null): void {
        if (this.strip.hoverX === x) return;
        this.strip.hoverX = x;
        this.scene.invalidate();
    }

    private panLastX = 0;

    private readonly stripPan: ISceneInteraction = {
        priority: -1,
        onPointerDown: (e) => {
            if (!this.inStrip(e.screen.y)) return false;
            this.panLastX = e.screen.x;
            return true;
        },
        onPointerMove: (e) => {
            this.camera.panByScreen(e.screen.x - this.panLastX, 0);
            this.panLastX = e.screen.x;
            this.setStripHover(e.screen.x);
        },
        onHover: (e) => this.setStripHover(this.inStrip(e.screen.y) ? e.screen.x : null),
        getCursor: (e) => (this.inStrip(e.screen.y) && (!e.hit || e.hit === this.strip) ? 'grab' : undefined),
    };

    private drawGrid = (ctx: CanvasRenderingContext2D): void => {
        const top = this.camera.y;
        const bottom = this.strip.top;
        ctx.save();
        ctx.strokeStyle = '#ffffff12';
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        for (const tick of this.strip.ticks()) {
            const x = this.store.timeToX(tick.seconds);
            ctx.beginPath();
            ctx.moveTo(x, top);
            ctx.lineTo(x, bottom);
            ctx.stroke();
        }
        ctx.restore();
    };

    // reads every observable before the dragging bail-out, so the autorun keeps its deps
    private sync(): void {
        const store = this.store;
        const chapters = store.chapterIds.flatMap((id) => {
            const range = store.chapterRange(id);
            const dto = store.chapters.get(id);
            if (!range || !dto) return [];
            const x = store.timeToX(range.start);
            return [
                {
                    id,
                    x,
                    width: Math.max(MIN_CHAPTER_WIDTH, store.timeToX(range.end) - x),
                    y: store.chapterY(id),
                    label: store.chapterTitle(id),
                    fill: locationColor(dto.location),
                    visible: store.isChapterVisible(id),
                },
            ];
        });
        const triggers = [...store.triggers.values()].flatMap((t) => {
            const time = store.triggerTime(t.triggerId);
            if (time === null) return [];
            return [
                {
                    id: t.triggerId,
                    x: store.timeToX(time),
                    name: displayText(t.name, t.triggerId),
                    visible:
                        store.showTriggers && (!store.chapters.has(t.chapterId) || store.isChapterVisible(t.chapterId)),
                },
            ];
        });
        const connections = store.connections;
        const showConnections = store.showConnections;
        const selected = store.selected;
        void store.revision;

        if (this.dragging) return; // the gesture's end commits, which re-runs this

        // selecting writes back to the store (`handleSelect`)
        runInAction(() => {
            this.applyChapters(chapters);
            this.applyTriggers(triggers);
            this.applyConnections(connections, showConnections);
            this.applySelection(selected);
        });

        if (!this.placed && chapters.length > 0) {
            this.placed = true;
            const first = Math.min(...chapters.map((c) => c.x));
            const top = Math.min(...chapters.map((c) => c.y));
            this.camera.set({ x: first - 80, y: top - 40 });
        }
    }

    private applyChapters(
        models: { id: string; x: number; width: number; y: number; label: string; fill: string; visible: boolean }[]
    ): void {
        const seen = new Set<string>();
        for (const m of models) {
            seen.add(m.id);
            const existing = this.chapterShapes.get(m.id);
            const props = { x: m.x, y: m.y, width: m.width, label: m.label, fill: m.fill, visible: m.visible };
            if (existing) {
                existing.update(props);
                continue;
            }
            const shape = new RectShape<TTimelineShapeData>({
                ...props,
                id: `chapter:${m.id}`,
                height: CHAPTER_HEIGHT,
                cornerRadius: 6,
                stroke: { color: '#ffffff55', width: 1, screenWidth: true },
                hoverStyle: { stroke: { color: '#ffffff', width: 2, screenWidth: true } },
                draggable: true,
                resizeEdges: ['left', 'right'],
                minWidth: MIN_CHAPTER_WIDTH,
                labelStyle: { color: '#fff', fontSize: 14 },
                data: { kind: 'chapter', id: m.id },
                onAction: () => this.store.openChapter(m.id),
            });
            this.chapterShapes.set(m.id, this.scene.add(shape, 'chapters'));
        }
        for (const [id, shape] of this.chapterShapes) {
            if (seen.has(id)) continue;
            this.scene.remove(shape);
            this.chapterShapes.delete(id);
        }
    }

    private applyTriggers(models: { id: string; x: number; name: string; visible: boolean }[]): void {
        const seen = new Set<string>();
        for (const m of models) {
            seen.add(m.id);
            const existing = this.triggerShapes.get(m.id);
            if (existing) {
                existing.update({ x: m.x, name: m.name, visible: m.visible });
                continue;
            }
            const shape = new TriggerShape<TTimelineShapeData>({
                id: `trigger:${m.id}`,
                x: m.x,
                name: m.name,
                visible: m.visible,
                getY: () => this.strip.top + TRIGGER_DOT_OFFSET,
                draggable: true,
                drag: { axis: 'x' },
                cursor: 'pointer',
                hoverStyle: { fill: '#66bb6a' },
                data: { kind: 'trigger', id: m.id },
                onAction: () => this.opts.onOpenTrigger?.(m.id),
            });
            this.triggerShapes.set(m.id, this.scene.add(shape, 'triggers'));
        }
        for (const [id, shape] of this.triggerShapes) {
            if (seen.has(id)) continue;
            this.scene.remove(shape);
            this.triggerShapes.delete(id);
        }
    }

    private applyConnections(connections: { from: string; to: string }[], show: boolean): void {
        for (const line of this.lines) this.scene.remove(line);
        this.lines = [];
        for (const { from, to } of connections) {
            const a = this.chapterShapes.get(from);
            const b = this.chapterShapes.get(to);
            if (!a || !b) continue;
            const line = new LineShape({
                from: { shape: a },
                to: { shape: b },
                arrow: 'end',
                stroke: { color: '#ff8a65', width: 2, screenWidth: true },
                interactive: false,
                selectable: false,
                visible: show && a.visible && b.visible,
            });
            this.lines.push(this.scene.add(line, 'connections'));
        }
    }

    private applySelection(selected: TimelineStore['selected']): void {
        const shape = selected
            ? selected.kind === 'chapter'
                ? this.chapterShapes.get(selected.id)
                : this.triggerShapes.get(selected.id)
            : undefined;
        const target = shape && shape.visible ? shape : null;
        if (this.selection.selected !== target) this.selection.select(target);
    }

    shapeOf(kind: 'chapter' | 'trigger', id: string): Shape | undefined {
        return kind === 'chapter' ? this.chapterShapes.get(id) : this.triggerShapes.get(id);
    }

    private handleSelect = ({ shape }: TSceneEvents['select']): void => {
        const next = timelineDataOf(shape);
        const cur = this.store.selected;
        if (cur?.kind === next?.kind && cur?.id === next?.id) return;
        this.store.select(next ? { kind: next.kind, id: next.id } : null);
    };

    private handleChange = ({ shape, kind, final, edge }: TSceneEvents['change']): void => {
        const data = timelineDataOf(shape);
        if (!data) return;
        if (!final) {
            this.dragging = true;
            this.showDragTooltip(shape, data);
            return;
        }
        this.dragging = false;
        this.opts.onTooltip?.(null);
        if (data.kind === 'trigger' && shape instanceof TriggerShape) {
            void this.store.commitTrigger(data.id, this.snapX(shape.x));
            return;
        }
        if (data.kind !== 'chapter' || !(shape instanceof RectShape)) return;
        const range = this.store.chapterRange(data.id);
        if (!range) return;
        const { start, end } = this.shapeRange(shape, kind, edge, range);
        void this.store.commitChapter(data.id, { start, end, y: shape.y });
    };

    private shapeRange(
        shape: RectShape,
        kind: TSceneEvents['change']['kind'],
        edge: TSceneEvents['change']['edge'],
        range: { start: number; end: number }
    ): { start: number; end: number } {
        const pps = this.store.pps;
        if (kind === 'move') {
            const start = this.snapX(shape.x);
            return { start, end: start + (range.end - range.start) };
        }
        let { start, end } = range;
        if (edge === 'left') start = Math.min(this.snapX(shape.x), end - snapStep(pps));
        if (edge === 'right') end = Math.max(this.snapX(shape.x + shape.width), start + snapStep(pps));
        return { start: Math.max(0, start), end };
    }

    private snapX(x: number): number {
        return Math.max(0, snapTime(this.store.xToTime(x), this.store.pps));
    }

    private renderTime(seconds: number): string {
        return this.opts.timeManager.renderTime(Time.fromS(Math.max(0, seconds)), 'dateTime');
    }

    private showHoverTooltip(shape: Shape | null, screen: { x: number; y: number }): void {
        const data = timelineDataOf(shape);
        if (!data || !this.opts.onTooltip) {
            this.opts.onTooltip?.(null);
            return;
        }
        const pos = { x: screen.x + 14, y: screen.y + 14 };
        if (data.kind === 'chapter') {
            const dto = this.store.chapters.get(data.id);
            const range = this.store.chapterRange(data.id);
            if (!dto || !range) return;
            const description = displayText(dto.description, '');
            this.opts.onTooltip({
                title: this.store.chapterTitle(data.id),
                lines: [
                    `${this.renderTime(range.start)} – ${this.renderTime(range.end)}`,
                    ...(description ? [description] : []),
                ],
                ...pos,
            });
        } else {
            const dto = this.store.triggers.get(data.id);
            const time = this.store.triggerTime(data.id);
            if (!dto || time === null) return;
            const description = displayText(dto.description, '');
            this.opts.onTooltip({
                title: displayText(dto.name, data.id),
                lines: [this.renderTime(time), ...(description ? [description] : [])],
                ...pos,
            });
        }
    }

    private showDragTooltip(shape: Shape, data: TTimelineShapeData): void {
        if (!this.opts.onTooltip) return;
        const b = shape.getBounds();
        const screen = this.camera.worldToScreen({ x: b.x, y: b.y + b.height });
        const pos = { x: Math.max(0, screen.x), y: screen.y + 8 };
        if (data.kind === 'trigger' && shape instanceof TriggerShape) {
            this.opts.onTooltip({ title: this.renderTime(this.snapX(shape.x)), lines: [], ...pos, y: screen.y - 60 });
            return;
        }
        const range = this.store.chapterRange(data.id);
        if (!range || !(shape instanceof RectShape)) return;
        const start = this.snapX(shape.x);
        const end = this.snapX(shape.x + shape.width);
        this.opts.onTooltip({ title: `${this.renderTime(start)} – ${this.renderTime(end)}`, lines: [], ...pos });
    }
}
