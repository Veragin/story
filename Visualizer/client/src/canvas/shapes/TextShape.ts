import { pointInRect } from '../geometry';
import { drawTextBlock, measureTextWidth, wrapText } from '../text';
import type { TPoint, TRect } from '../types';
import { Shape, type TShapeProps } from './Shape';

export type TTextProps<TData = unknown> = TShapeProps<TData> & {
    x: number;
    y: number;
    text: string;
    /** In world units. Default 14. */
    fontSize?: number;
    fontFamily?: string;
    fontWeight?: string | number;
    /** Text color. Default `#fff`. (`fill`, if set, paints a background box.) */
    color?: string;
    /** Horizontal anchor of `x`. Default `left`. */
    align?: 'left' | 'center' | 'right';
    /** Vertical anchor of `y`. Default `top`. */
    verticalAlign?: 'top' | 'middle' | 'bottom';
    /** Wrap width in world units. */
    maxWidth?: number;
    /** Background box padding in world units. Default 2. */
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
    align: 'left' | 'center' | 'right';
    verticalAlign: 'top' | 'middle' | 'bottom';
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
        return this.fontSize * 1.25;
    }

    /** The text box without padding. */
    private textRect(): TRect {
        const lines = wrapText(this.text, this.maxWidth, this.font);
        const width = Math.max(0, ...lines.map((l) => measureTextWidth(l, this.font)));
        const height = lines.length * this.lineHeight;
        const x = this.align === 'center' ? this.x - width / 2 : this.align === 'right' ? this.x - width : this.x;
        const y =
            this.verticalAlign === 'middle'
                ? this.y - height / 2
                : this.verticalAlign === 'bottom'
                  ? this.y - height
                  : this.y;
        return { x, y, width, height };
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
            x: this.align === 'center' ? r.x + r.width / 2 : this.align === 'right' ? r.x + r.width : r.x,
            y: r.y,
            align: this.align,
            verticalAlign: 'top',
            lineHeight: this.lineHeight,
            maxWidth: this.maxWidth,
            color: this.color,
        });
    }
}
