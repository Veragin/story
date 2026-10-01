import { wrapText, type Camera, type TSize } from '../../canvas';
import type { MapStore } from '../MapStore';
import type { TMapDocument, TTile } from '../types';
import {
    DESCRIPTION_FONT_SIZE,
    DESCRIPTION_MAX_LINES,
    DESCRIPTION_MIN_ZOOM,
    EMPTY_TILE_FILL,
    EMPTY_TILE_STROKE,
    HEX_POINTS,
    HEX_RADIUS,
    LABEL_FONT_SIZE,
    LABEL_MIN_ZOOM,
    MAP_TILE_AVG_HEIGHT,
    MAP_TILE_WIDTH,
    WIDGET_BORDER_COLOR,
    WIDGET_BORDER_WIDTH,
} from './constants';
import { computeTilePos, findNeighbor, mapWorldBounds, minimapSize } from './utils';

const FONT_FAMILY = 'system-ui, sans-serif';
const TEXT_MAX_WIDTH = MAP_TILE_WIDTH * 0.86;

export class Draw {
    private readonly ctx: CanvasRenderingContext2D | null;
    private frame: number | null = null;
    private destroyed = false;
    private cssSize: TSize = { width: 0, height: 0 };
    private readonly pixelRatio: number;
    private readonly resizeObserver: ResizeObserver | null = null;
    private readonly offCamera: () => void;
    private readonly onWindowResize = () => this.resize();

    constructor(
        private readonly mapStore: MapStore,
        readonly canvas: HTMLCanvasElement,
        private readonly camera: Camera
    ) {
        let ctx: CanvasRenderingContext2D | null = null;
        try {
            ctx = canvas.getContext('2d');
        } catch {
            ctx = null;
        }
        this.ctx = ctx;
        this.pixelRatio = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
        this.offCamera = camera.subscribe(() => this.render());
        if (typeof ResizeObserver !== 'undefined') {
            this.resizeObserver = new ResizeObserver(() => this.resize());
            this.resizeObserver.observe(canvas);
        } else {
            window.addEventListener('resize', this.onWindowResize);
        }
        this.resize();
    }

    get size(): TSize {
        return { ...this.cssSize };
    }

    get isDestroyed() {
        return this.destroyed;
    }

    resize = (size?: TSize) => {
        const width = size?.width ?? this.canvas.clientWidth;
        const height = size?.height ?? this.canvas.clientHeight;
        this.cssSize = { width, height };
        const w = Math.round(width * this.pixelRatio);
        const h = Math.round(height * this.pixelRatio);
        if (w > 0 && h > 0 && (this.canvas.width !== w || this.canvas.height !== h)) {
            this.canvas.width = w;
            this.canvas.height = h;
        }
        this.render();
    };

    render = () => {
        if (this.destroyed || this.frame !== null) return;
        this.frame = requestAnimationFrame(() => {
            this.frame = null;
            if (!this.destroyed) this.renderNow();
        });
    };

    destroy = () => {
        if (this.destroyed) return;
        this.destroyed = true;
        if (this.frame !== null) cancelAnimationFrame(this.frame);
        this.frame = null;
        this.resizeObserver?.disconnect();
        window.removeEventListener('resize', this.onWindowResize);
        this.offCamera();
    };

    renderNow = () => {
        const ctx = this.ctx;
        if (!ctx) return;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        const map = this.mapStore.data;
        if (!map) return;

        ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
        ctx.save();
        this.camera.applyTo(ctx);
        const range = this.visibleRange(map);
        ctx.lineWidth = 3;
        for (let i = range.startI; i <= range.endI; i++) {
            for (let j = range.startJ; j <= range.endJ; j++) {
                this.drawTile(ctx, map, i, j);
            }
        }
        this.drawTexts(ctx, map, range);
        this.drawHighlights(ctx, map);
        ctx.restore();

        if (this.mapStore.interactive && this.mapStore.showMinimap) this.renderMinimap(ctx, map);
    };

    visibleRange = (map: Pick<TMapDocument, 'width' | 'height'>) => {
        const view = this.camera.visibleRect(this.cssSize);
        const clampI = (v: number) => Math.min(Math.max(0, v), map.height - 1);
        const clampJ = (v: number) => Math.min(Math.max(0, v), map.width - 1);
        return {
            startI: clampI(Math.floor((view.y - HEX_RADIUS) / MAP_TILE_AVG_HEIGHT)),
            endI: clampI(Math.ceil((view.y + view.height + HEX_RADIUS) / MAP_TILE_AVG_HEIGHT)),
            startJ: clampJ(Math.floor(view.x / MAP_TILE_WIDTH) - 1),
            endJ: clampJ(Math.ceil((view.x + view.width) / MAP_TILE_WIDTH)),
        };
    };

    private drawTile(ctx: CanvasRenderingContext2D, map: TMapDocument, i: number, j: number) {
        const tile = map.data[i]?.[j]?.tile;
        if (tile === undefined) return;
        const color = tile === 'none' ? undefined : map.palette[tile]?.color;
        this.prepareTilePath(ctx, i, j);
        if (color) {
            ctx.fillStyle = color;
            ctx.strokeStyle = color;
            ctx.lineWidth = 3;
        } else {
            ctx.fillStyle = EMPTY_TILE_FILL;
            ctx.strokeStyle = EMPTY_TILE_STROKE;
            ctx.lineWidth = 1;
        }
        ctx.fill();
        ctx.stroke();
    }

    private drawTexts(ctx: CanvasRenderingContext2D, map: TMapDocument, range: ReturnType<Draw['visibleRange']>) {
        const zoom = this.camera.zoom;
        if (zoom < LABEL_MIN_ZOOM) return;
        const withDescription = zoom >= DESCRIPTION_MIN_ZOOM;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let i = range.startI; i <= range.endI; i++) {
            for (let j = range.startJ; j <= range.endJ; j++) {
                const tile = map.data[i]?.[j];
                if (!tile || (!tile.label && !tile.description)) continue;
                const { x, y } = computeTilePos(i, j);
                const color = textColorFor(tile.tile === 'none' ? undefined : map.palette[tile.tile]?.color);
                ctx.fillStyle = color;
                const lines = withDescription && tile.description ? descriptionLines(tile.description) : [];
                const labelHeight = tile.label ? LABEL_FONT_SIZE * 1.2 : 0;
                const total = labelHeight + lines.length * DESCRIPTION_FONT_SIZE * 1.2;
                let top = y - total / 2;
                if (tile.label) {
                    ctx.font = `bold ${LABEL_FONT_SIZE}px ${FONT_FAMILY}`;
                    ctx.fillText(ellipsize(tile.label, LABEL_FONT_SIZE, 'bold'), x, top + labelHeight / 2);
                    top += labelHeight;
                }
                if (lines.length > 0) {
                    ctx.font = `${DESCRIPTION_FONT_SIZE}px ${FONT_FAMILY}`;
                    lines.forEach((line, k) => ctx.fillText(line, x, top + DESCRIPTION_FONT_SIZE * 1.2 * (k + 0.5)));
                } else if (tile.description) {
                    // too small to read at this zoom: marker only
                    ctx.beginPath();
                    ctx.arc(x, y + HEX_RADIUS * 0.55, 2.5, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }
    }

    private drawHighlights(ctx: CanvasRenderingContext2D, map: TMapDocument) {
        const store = this.mapStore;
        if (!store.interactive) return;
        ctx.lineWidth = 2 / Math.max(this.camera.zoom, 0.5);
        const hover = store.hoverTile;
        if (hover) {
            ctx.strokeStyle = '#FF0000';
            const tiles: TTile[] =
                store.tool === 'paint'
                    ? findNeighbor(hover.i, hover.j, store.brushSize, map.height, map.width)
                    : [hover];
            for (const t of tiles) {
                this.prepareTilePath(ctx, t.i, t.j);
                ctx.stroke();
            }
        }
        const selected = store.selectedTile;
        if (selected && store.tool === 'select') {
            ctx.strokeStyle = '#FFDE04';
            ctx.lineWidth = 4 / Math.max(this.camera.zoom, 0.5);
            this.prepareTilePath(ctx, selected.i, selected.j);
            ctx.stroke();
        }
    }

    private renderMinimap(ctx: CanvasRenderingContext2D, map: TMapDocument) {
        const size = minimapSize(this.cssSize, map);
        const top = this.cssSize.height - size.height;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, top, size.width, size.height);

        const cellW = size.width / map.width;
        const cellH = size.height / map.height;
        for (let i = 0; i < map.height; i++) {
            for (let j = 0; j < map.width; j++) {
                const tile = map.data[i]?.[j]?.tile;
                if (tile === undefined || tile === 'none') continue;
                ctx.fillStyle = map.palette[tile]?.color ?? '#000000';
                ctx.fillRect(j * cellW, top + i * cellH, cellW + 1, cellH + 1);
            }
        }

        const bounds = mapWorldBounds(map);
        const view = this.camera.visibleRect(this.cssSize);
        ctx.save();
        ctx.strokeStyle = '#FFDE04';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.rect(0, top, size.width, size.height);
        ctx.clip();
        ctx.beginPath();
        ctx.rect(
            ((view.x - bounds.x) / bounds.width) * size.width,
            top + ((view.y - bounds.y) / bounds.height) * size.height,
            (view.width / bounds.width) * size.width,
            (view.height / bounds.height) * size.height
        );
        ctx.stroke();
        ctx.restore();

        ctx.beginPath();
        ctx.lineWidth = WIDGET_BORDER_WIDTH;
        ctx.strokeStyle = WIDGET_BORDER_COLOR;
        ctx.roundRect?.(1, top, size.width, size.height - 1, 6);
        ctx.stroke();
    }

    private prepareTilePath(ctx: CanvasRenderingContext2D, i: number, j: number) {
        const { x, y } = computeTilePos(i, j);
        ctx.beginPath();
        ctx.moveTo(x + HEX_POINTS[0].x, y + HEX_POINTS[0].y);
        for (let k = 1; k < HEX_POINTS.length; k++) {
            ctx.lineTo(x + HEX_POINTS[k].x, y + HEX_POINTS[k].y);
        }
        ctx.closePath();
    }
}

export const textColorFor = (background: string | undefined): string => {
    const hex = background?.replace('#', '') ?? '';
    const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex.slice(0, 6);
    if (!/^[0-9a-fA-F]{6}$/.test(full)) return '#ffffff';
    const [r, g, b] = [0, 2, 4].map((k) => parseInt(full.slice(k, k + 2), 16));
    return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#111111' : '#ffffff';
};

export const descriptionLines = (description: string): string[] => {
    const font = { fontSize: DESCRIPTION_FONT_SIZE, fontFamily: FONT_FAMILY };
    const lines = wrapText(description, TEXT_MAX_WIDTH, font);
    if (lines.length <= DESCRIPTION_MAX_LINES) return lines;
    const kept = lines.slice(0, DESCRIPTION_MAX_LINES);
    kept[kept.length - 1] = `${kept[kept.length - 1].replace(/\s*\S{0,3}$/, '')}…`;
    return kept;
};

const ellipsize = (text: string, fontSize: number, fontWeight?: string): string => {
    const lines = wrapText(text, TEXT_MAX_WIDTH, { fontSize, fontFamily: FONT_FAMILY, fontWeight });
    return lines.length > 1 ? `${lines[0]}…` : text;
};
