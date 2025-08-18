import { VisualObject } from './VisualObject';

/**
 * Example implementation of a visual object
 */
export class TextContent extends VisualObject {
    private _text: string;
    private _font: string;
    private _color: string;
    private _alignment: TTextAlignment;

    constructor(init: {
        position: TPoint;
        size: TSize;
        text: string;
        font?: string;
        color?: string;
        alignment?: TTextAlignment;
    }) {
        super(init.position, init.size);
        this._text = init.text;
        this._font = init.font ?? '14px Roboto';
        this._color = init.color ?? '#000000';
        this._alignment = init.alignment ?? 'top_left';
    }

    override draw(ctx: CanvasRenderingContext2D): void {
        ctx.font = this._font;
        ctx.fillStyle = this._color;

        const align = this._alignment.split('_');
        ctx.textBaseline = align[0] as CanvasTextBaseline;
        ctx.textAlign = align[1] as CanvasTextAlign;

        const x =
            align[1] === 'left'
                ? this.position.x
                : align[1] === 'center'
                  ? this.position.x + this.size.width / 2
                  : this.position.x + this.size.width;
        const y =
            align[0] === 'top'
                ? this.position.y
                : align[0] === 'middle'
                  ? this.position.y + this.size.height / 2
                  : this.position.y + this.size.height;

        ctx.fillText(this._text, x, y);
    }

    setText(text: string): void {
        let changed = this._text !== text;
        this._text = text;
        this.redraw(changed, '');
    }

    setFont(font: string): void {
        let changed = this._font !== font;
        this._font = font;
        this.redraw(changed, '');
    }

    setColor(color: string): void {
        let changed = this._color !== color;
        this._color = color;
        this.redraw(changed, '');
    }

    getText(): string {
        return this._text;
    }

    getFont(): string {
        return this._font;
    }

    getColor(): string {
        return this._color;
    }

    getAlignment() {
        return this._alignment;
    }
}

export type TTextAlignment =
    | 'top_left'
    | 'top_center'
    | 'top_right'
    | 'middle_left'
    | 'middle_center'
    | 'middle_right'
    | 'bottom_left'
    | 'bottom_center'
    | 'bottom_right';
