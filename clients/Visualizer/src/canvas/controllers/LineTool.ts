import { Emitter } from '../Emitter';
import type { ISceneInteraction, Scene, TScenePointerEvent } from '../Scene';
import { drawArrowHead, isAnchor, LineShape, type TArrow, type TLineEnd } from '../shapes/LineShape';
import { applyStroke, type Shape } from '../shapes/Shape';
import type { TPoint, TStroke } from '../types';

export type TLineToolOptions = {
    snap?: boolean;
    snapFilter?: (shape: Shape) => boolean;
    anchor?: 'border' | 'center';
    arrow?: TArrow;
    stroke?: TStroke;
    layer?: string;
    continuous?: boolean;
    // null cancels the placement
    create?: (from: TLineEnd, to: TLineEnd) => LineShape | null;
    priority?: number;
};

export type TLineToolEvents = {
    state: { active: boolean; placing: boolean };
};

export class LineTool implements ISceneInteraction {
    readonly priority: number;
    readonly events = new Emitter<TLineToolEvents>();
    private _active = false;
    private from: TLineEnd | null = null;
    private cursorWorld: TPoint | null = null;
    private readonly options: TLineToolOptions;
    private readonly disposers: (() => void)[] = [];

    constructor(
        readonly scene: Scene,
        options: TLineToolOptions = {}
    ) {
        this.options = options;
        this.priority = options.priority ?? 20;
        this.disposers.push(
            scene.addInteraction(this),
            scene.events.on('editable', ({ editable }) => {
                if (!editable) this.deactivate();
            })
        );
    }

    get active(): boolean {
        return this._active;
    }
    get placing(): boolean {
        return this.from !== null;
    }

    activate(): void {
        if (this._active || !this.scene.editable) return;
        this._active = true;
        this.emitState();
    }

    deactivate(): void {
        if (!this._active) return;
        this._active = false;
        this.from = null;
        this.scene.invalidate();
        this.emitState();
    }

    toggle(): void {
        if (this._active) this.deactivate();
        else this.activate();
    }

    destroy(): void {
        for (const d of this.disposers.splice(0)) d();
        this.events.clear();
    }

    private get on(): boolean {
        return this._active && this.scene.editable;
    }

    private emitState(): void {
        this.events.emit('state', { active: this._active, placing: this.placing });
    }

    private endAt(e: TScenePointerEvent): TLineEnd {
        const snap = this.options.snap ?? true;
        const filter = this.options.snapFilter ?? ((s: Shape) => !(s instanceof LineShape));
        const target = snap ? this.scene.hitTest(e.world, filter) : null;
        return target ? { shape: target, anchor: this.options.anchor ?? 'border' } : { ...e.world };
    }

    onPointerDown(e: TScenePointerEvent): boolean {
        // swallow presses on shapes so the selection cannot drag them; empty space still pans
        return this.on && e.hit !== null;
    }

    onClick(e: TScenePointerEvent): boolean {
        if (!this.on) return false;
        const end = this.endAt(e);
        if (!this.from) {
            this.from = end;
            this.cursorWorld = e.world;
            this.emitState();
            this.scene.invalidate();
            return true;
        }
        if (sameEnd(this.from, end)) return true;
        const from = this.from;
        this.from = null;
        const line = this.options.create
            ? this.options.create(from, end)
            : new LineShape({
                  from,
                  to: end,
                  arrow: this.options.arrow ?? 'end',
                  stroke: this.options.stroke ?? { color: '#ddd', width: 2, screenWidth: true },
              });
        if (line) {
            this.scene.add(line, this.options.layer);
            this.scene.events.emit('create', { shape: line, tool: 'line' });
        }
        if (!this.options.continuous) this.deactivate();
        else this.emitState();
        this.scene.invalidate();
        return true;
    }

    onDoubleClick(): boolean {
        return this.on; // no `action` while placing lines
    }

    onContextMenu(): boolean {
        if (!this._active) return false;
        this.deactivate();
        return true;
    }

    onHover(e: TScenePointerEvent): void {
        if (!this.on || !this.from) return;
        this.cursorWorld = e.world;
        this.scene.invalidate();
    }

    onKeyDown(e: KeyboardEvent): boolean {
        if (e.key !== 'Escape' || !this._active) return false;
        this.deactivate();
        return true;
    }

    getCursor(): string | undefined {
        return this.on ? 'crosshair' : undefined;
    }

    drawOverlay(ctx: CanvasRenderingContext2D, scene: Scene): void {
        if (!this.on || !this.from || !this.cursorWorld) return;
        const start = isAnchor(this.from) ? this.from.shape.borderPoint(this.cursorWorld) : this.from;
        const end = this.cursorWorld;
        const zoom = scene.camera.zoom;
        ctx.save();
        applyStroke(ctx, { color: '#4da3ff', width: 2, dash: [6, 4], screenWidth: true }, zoom);
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
        ctx.fillStyle = '#4da3ff';
        const arrow = this.options.arrow ?? 'end';
        if (arrow === 'end' || arrow === 'both') drawArrowHead(ctx, start, end, 10 / zoom);
        ctx.restore();
    }
}

const sameEnd = (a: TLineEnd, b: TLineEnd): boolean => {
    if (isAnchor(a) || isAnchor(b)) return isAnchor(a) && isAnchor(b) && a.shape === b.shape;
    return a.x === b.x && a.y === b.y;
};
