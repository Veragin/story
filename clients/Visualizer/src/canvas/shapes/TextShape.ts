import { pointInRect } from '../geometry';
import {
    alignOffset,
    drawTextBlock,
    lineHeightFor,
    measureTextWidth,
    wrapText,
    type TAlign,
    type TVerticalAlign,
} from '../text';
import type { TPoint, TRect } from '../types';
import { Shape, type TShapeProps } from './Shape';

export type TTextProps<TData = unknown> = TShapeProps<TData> & {
    x: number;
    y: number;
    text: string;
    fontSize?: number;
    fontFamily?: string;
    fontWeight?: string | number;
    // `fill` paints a background box
    color?: string;
    align?: TAlign;
    verticalAlign?: TVerticalAlign;
    maxWidth?: number;
    padding?: number;
};

export class TextShape<TData = unknown> extends Shape<TData> {
    readonly kind = 'text';
    x: number;
    y: number;
    text: string;
    fontSize: number;
    fontFamily?: string;
    fontWeight?: string | number;
    color: string;
    align: TAlign;
    verticalAlign: TVerticalAlign;
    maxWidth?: number;
    padding: number;

    constructor(props: TTextProps<TData>) {
        super(props);
        this.x = props.x;
        this.y = props.y;
        this.text = props.text;
        this.fontSize = props.fontSize ?? 14;
        this.fontFamily = props.fontFamily;
        this.fontWeight = props.fontWeight;
        this.color = props.color ?? '#fff';
        this.align = props.align ?? 'left';
        this.verticalAlign = props.verticalAlign ?? 'top';
        this.maxWidth = props.maxWidth;
        this.padding = props.padding ?? 2;
    }

    update(patch: Partial<TTextProps<TData>>): this {
        return super.update(patch);
    }

    private get font() {
        return { fontSize: this.fontSize, fontFamily: this.fontFamily, fontWeight: this.fontWeight };
    }

    private get lineHeight(): number {
        return lineHeightFor(this.fontSize);
    }

    private textRect(): TRect {
        const lines = wrapText(this.text, this.maxWidth, this.font);
        const width = Math.max(0, ...lines.map((l) => measureTextWidth(l, this.font)));
        const height = lines.length * this.lineHeight;
        return {
            x: this.x - alignOffset(this.align, width),
            y: this.y - alignOffset(this.verticalAlign, height),
            width,
            height,
        };
    }

    getBounds(): TRect {
        const r = this.textRect();
        const p = this.padding;
        return { x: r.x - p, y: r.y - p, width: r.width + p * 2, height: r.height + p * 2 };
    }

    hitTest(p: TPoint, tolerance: number): boolean {
        return pointInRect(p, this.getBounds(), tolerance);
    }

    tracePath(ctx: CanvasRenderingContext2D): void {
        const b = this.getBounds();
        ctx.rect(b.x, b.y, b.width, b.height);
    }

    translate(dx: number, dy: number): void {
        this.x += dx;
        this.y += dy;
        this.invalidate();
    }

    getOrigin(): TPoint {
        return { x: this.x, y: this.y };
    }

    protected drawLabel(ctx: CanvasRenderingContext2D): void {
        const r = this.textRect();
        drawTextBlock(ctx, this.text, {
            ...this.font,
            x: r.x + alignOffset(this.align, r.width),
            y: r.y,
            align: this.align,
            verticalAlign: 'top',
            lineHeight: this.lineHeight,
            maxWidth: this.maxWidth,
            color: this.color,
        });
    }
}
