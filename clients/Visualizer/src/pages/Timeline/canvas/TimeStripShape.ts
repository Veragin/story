import { Time, type TimeManager } from '@story/shared';
import { geometry, Shape, type TPoint, type TRect, type TSize } from '../../../canvas';
import { labelStep, xToTime } from '../store/timeScale';

export const STRIP_HEIGHT = 96;
export const TRIGGER_DOT_OFFSET = 34;
const BAR_TOP = 52;
const BAR_HEIGHT = 10;
const TICK_TOP = 48;
const TICK_BOTTOM = 72;
const LABEL_Y = 84;

const BAND_COLOR = '#101316';
const BAR_COLOR = '#61666F';
const LABEL_COLOR = '#ffffff';
const MARKER_COLOR = '#ff3b30';

export type TStripOptions = {
    getViewport: () => TSize;
    getPps: () => number;
    timeManager: TimeManager;
};

export class TimeStripShape extends Shape<{ kind: 'strip' }> {
    readonly kind = 'time-strip';
    // screen x, usable as a world offset because the timeline's zoom is locked at 1
    hoverX: number | null = null;

    constructor(private readonly opts: TStripOptions) {
        super({ id: 'time-strip', selectable: false, cursor: 'grab', data: { kind: 'strip' }, zIndex: 0 });
    }

    get top(): number {
        const cam = this.host?.camera;
        const { height } = this.opts.getViewport();
        return (cam?.y ?? 0) + Math.max(0, height - STRIP_HEIGHT);
    }

    getBounds(): TRect {
        const cam = this.host?.camera;
        const { width } = this.opts.getViewport();
        return { x: cam?.x ?? 0, y: this.top, width: Math.max(width, 1), height: STRIP_HEIGHT };
    }

    hitTest(p: TPoint): boolean {
        return geometry.pointInRect(p, this.getBounds(), 0);
    }

    tracePath(ctx: CanvasRenderingContext2D): void {
        const b = this.getBounds();
        ctx.rect(b.x, b.y, b.width, b.height);
    }

    translate(): void {}

    canTranslate(): boolean {
        return false;
    }

    ticks(): { seconds: number; label: string }[] {
        const cam = this.host?.camera;
        if (!cam) return [];
        const pps = this.opts.getPps();
        const { width } = this.opts.getViewport();
        const { step, format } = labelStep(pps);
        const t0 = Math.max(0, xToTime(cam.x, pps));
        const t1 = xToTime(cam.x + width, pps);
        const out: { seconds: number; label: string }[] = [];
        for (let t = Math.ceil(t0 / step) * step; t <= t1 && out.length < 200; t += step) {
            out.push({ seconds: t, label: this.opts.timeManager.renderTime(Time.fromS(t), format) });
        }
        return out;
    }

    draw(ctx: CanvasRenderingContext2D): void {
        const b = this.getBounds();
        const pps = this.opts.getPps();
        ctx.save();
        ctx.setLineDash([]);
        ctx.fillStyle = BAND_COLOR;
        ctx.fillRect(b.x, b.y, b.width, b.height);
        ctx.fillStyle = BAR_COLOR;
        ctx.fillRect(b.x, b.y + BAR_TOP, b.width, BAR_HEIGHT);

        ctx.strokeStyle = BAR_COLOR;
        ctx.lineWidth = 2;
        ctx.font = '13px Roboto, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = LABEL_COLOR;
        for (const tick of this.ticks()) {
            const x = tick.seconds * pps;
            ctx.beginPath();
            ctx.moveTo(x, b.y + TICK_TOP);
            ctx.lineTo(x, b.y + TICK_BOTTOM);
            ctx.stroke();
            ctx.fillText(tick.label, x, b.y + LABEL_Y);
        }

        if (this.hoverX !== null) {
            const x = b.x + this.hoverX;
            const seconds = Math.max(0, xToTime(x, pps));
            const text = this.opts.timeManager.renderTime(Time.fromS(seconds), 'dateTime');
            ctx.fillStyle = MARKER_COLOR;
            ctx.fillRect(x - 1, b.y + BAR_TOP - 8, 2, BAR_HEIGHT + 16);
            const w = Math.max(90, (ctx.measureText?.(text)?.width ?? text.length * 7) + 12);
            ctx.fillStyle = '#171a1e';
            ctx.fillRect(x - w / 2, b.y + 2, w, 18);
            ctx.fillStyle = LABEL_COLOR;
            ctx.fillText(text, x, b.y + 11);
        }
        ctx.restore();
    }
}
