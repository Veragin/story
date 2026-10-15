import type { ISceneInteraction, Scene, TScenePointerEvent } from '../Scene';
import { RectShape, type TRectEdge } from '../shapes/RectShape';
import type { Shape } from '../shapes/Shape';
import type { TPoint, TRect } from '../types';

export type TSelectionOptions = {
    highlight?: { color: string; width: number };
    handleSize?: number;
    edgeGrab?: number;
    selectInViewMode?: boolean;
    escapeClears?: boolean;
    priority?: number;
};

type TGesture =
    | { type: 'move'; shape: Shape; startWorld: TPoint; startOrigin: TPoint; changed: boolean }
    | { type: 'resize'; shape: RectShape; edge: TRectEdge; startWorld: TPoint; startRect: TRect; changed: boolean };

export class SelectionController implements ISceneInteraction {
    readonly priority: number;
    private _selected: Shape | null = null;
    private gesture: TGesture | null = null;
    private readonly options: Required<Omit<TSelectionOptions, 'priority'>>;
    private readonly disposers: (() => void)[] = [];

    constructor(
        readonly scene: Scene,
        options: TSelectionOptions = {}
    ) {
        this.priority = options.priority ?? 0;
        this.options = {
            highlight: options.highlight ?? { color: '#4da3ff', width: 2 },
            handleSize: options.handleSize ?? 8,
            edgeGrab: options.edgeGrab ?? 6,
            selectInViewMode: options.selectInViewMode ?? false,
            escapeClears: options.escapeClears ?? true,
        };
        this.disposers.push(
            scene.addInteraction(this),
            scene.events.on('remove', ({ shape }) => {
                if (shape === this._selected) this.select(null);
            }),
            scene.events.on('editable', ({ editable }) => {
                this.gesture = null;
                if (!editable && !this.options.selectInViewMode) this.select(null);
            })
        );
    }

    get selected(): Shape | null {
        return this._selected;
    }

    private get canSelect(): boolean {
        return this.scene.editable || this.options.selectInViewMode;
    }

    select(shape: Shape | null): void {
        if (shape === this._selected) return;
        const previous = this._selected;
        this._selected = shape;
        this.gesture = null;
        this.scene.invalidate();
        this.scene.events.emit('select', { shape, previous });
    }

    destroy(): void {
        for (const d of this.disposers.splice(0)) d();
    }

    onClick(e: TScenePointerEvent): boolean {
        if (!this.canSelect) return false;
        const hit = e.hit && e.hit.selectable ? e.hit : null;
        this.select(hit);
        return true;
    }

    onPointerDown(e: TScenePointerEvent): boolean {
        const shape = this._selected;
        if (!this.scene.editable || !shape || !shape.visible || !this.scene.has(shape)) return false;
        const edge = this.edgeAt(e);
        if (edge && shape instanceof RectShape) {
            this.gesture = { type: 'resize', shape, edge, startWorld: e.world, startRect: shape.rect, changed: false };
            return true;
        }
        if (shape.draggable && shape.canTranslate() && shape.hitTest(e.world, e.tolerance)) {
            this.gesture = {
                type: 'move',
                shape,
                startWorld: e.world,
                startOrigin: shape.getOrigin(),
                changed: false,
            };
            return true;
        }
        return false;
    }

    onPointerMove(e: TScenePointerEvent): void {
        const g = this.gesture;
        if (!g) return;
        const dx = e.world.x - g.startWorld.x;
        const dy = e.world.y - g.startWorld.y;
        if (g.type === 'move') {
            let next = { x: g.startOrigin.x + dx, y: g.startOrigin.y + dy };
            if (g.shape.drag?.axis === 'x') next.y = g.startOrigin.y;
            if (g.shape.drag?.axis === 'y') next.x = g.startOrigin.x;
            if (g.shape.drag?.constrain) next = g.shape.drag.constrain(next, g.shape);
            const before = g.shape.getOrigin();
            if (before.x === next.x && before.y === next.y) return;
            g.shape.setOrigin(next);
            g.changed = true;
            this.scene.events.emit('change', { shape: g.shape, kind: 'move', final: false });
        } else {
            const next = resizeRect(g.startRect, g.edge, dx, dy, g.shape.minWidth, g.shape.minHeight);
            const r = g.shape.constrainResize ? g.shape.constrainResize(next, g.edge, g.shape) : next;
            const cur = g.shape.rect;
            if (cur.x === r.x && cur.y === r.y && cur.width === r.width && cur.height === r.height) return;
            g.shape.setRect(r);
            g.changed = true;
            this.scene.events.emit('change', { shape: g.shape, kind: 'resize', final: false, edge: g.edge });
        }
    }

    onPointerUp(): void {
        const g = this.gesture;
        this.gesture = null;
        if (!g || !g.changed) return;
        this.scene.events.emit(
            'change',
            g.type === 'move'
                ? { shape: g.shape, kind: 'move', final: true }
                : { shape: g.shape, kind: 'resize', final: true, edge: g.edge }
        );
    }

    onKeyDown(e: KeyboardEvent): boolean {
        if (e.key === 'Escape' && this.options.escapeClears && this._selected) {
            this.select(null);
            return true;
        }
        return false;
    }

    getCursor(e: TScenePointerEvent): string | undefined {
        if (!this.canSelect) return undefined;
        const edge = this.scene.editable ? this.edgeAt(e) : null;
        if (edge) return edge === 'left' || edge === 'right' ? 'ew-resize' : 'ns-resize';
        const s = this._selected;
        if (s && this.scene.editable && s.draggable && s.canTranslate() && e.hit === s) return s.cursor ?? 'move';
        if (e.hit?.selectable) return e.hit.cursor ?? 'pointer';
        return undefined;
    }

    drawOverlay(ctx: CanvasRenderingContext2D, scene: Scene): void {
        const s = this._selected;
        if (!s || !s.visible || !scene.has(s)) return;
        const zoom = scene.camera.zoom;
        const { color, width } = this.options.highlight;
        ctx.save();
        ctx.setLineDash([]);
        ctx.strokeStyle = color;
        ctx.lineWidth = width / zoom;
        ctx.beginPath();
        s.tracePath(ctx);
        ctx.stroke();
        if (scene.editable && s instanceof RectShape) {
            const size = this.options.handleSize / zoom;
            ctx.fillStyle = color;
            for (const edge of s.resizeEdges) {
                const p = edgeMidpoint(s.rect, edge);
                const vertical = edge === 'left' || edge === 'right';
                const w = vertical ? size / 2 : Math.min(size * 2, s.width);
                const h = vertical ? Math.min(size * 2, s.height) : size / 2;
                ctx.fillRect(p.x - w / 2, p.y - h / 2, w, h);
            }
        }
        ctx.restore();
    }

    private edgeAt(e: TScenePointerEvent): TRectEdge | null {
        const s = this._selected;
        if (!(s instanceof RectShape) || s.resizeEdges.length === 0 || !s.visible) return null;
        const grab = this.options.edgeGrab / this.scene.camera.zoom;
        const { x, y, width, height } = s.rect;
        const p = e.world;
        const inY = p.y >= y - grab && p.y <= y + height + grab;
        const inX = p.x >= x - grab && p.x <= x + width + grab;
        let best: TRectEdge | null = null;
        let bestD = grab;
        const consider = (edge: TRectEdge, d: number, inside: boolean) => {
            if (inside && s.resizeEdges.includes(edge) && d <= bestD) {
                best = edge;
                bestD = d;
            }
        };
        consider('left', Math.abs(p.x - x), inY);
        consider('right', Math.abs(p.x - (x + width)), inY);
        consider('top', Math.abs(p.y - y), inX);
        consider('bottom', Math.abs(p.y - (y + height)), inX);
        return best;
    }
}

export const resizeRect = (
    r: TRect,
    edge: TRectEdge,
    dx: number,
    dy: number,
    minWidth: number,
    minHeight: number
): TRect => {
    const right = r.x + r.width;
    const bottom = r.y + r.height;
    switch (edge) {
        case 'left': {
            const x = Math.min(r.x + dx, right - minWidth);
            return { ...r, x, width: right - x };
        }
        case 'right':
            return { ...r, width: Math.max(minWidth, r.width + dx) };
        case 'top': {
            const y = Math.min(r.y + dy, bottom - minHeight);
            return { ...r, y, height: bottom - y };
        }
        case 'bottom':
            return { ...r, height: Math.max(minHeight, r.height + dy) };
    }
};

const edgeMidpoint = (r: TRect, edge: TRectEdge): TPoint => {
    switch (edge) {
        case 'left':
            return { x: r.x, y: r.y + r.height / 2 };
        case 'right':
            return { x: r.x + r.width, y: r.y + r.height / 2 };
        case 'top':
            return { x: r.x + r.width / 2, y: r.y };
        case 'bottom':
            return { x: r.x + r.width / 2, y: r.y + r.height };
    }
};
