import { VisualObject } from "./VisualObject";

/**
 * Example implementation of a visual object
 */
export class TextContent extends VisualObject {
    private _text: string;
    private _font: string;
    private _color: string;

    constructor(
        position: TPoint,
        size: TSize,
        text: string,
        font: string = "14px Arial",
        color: string = "#000000"
    ) {
        super(position, size);
        this._text = text;
        this._font = font;
        this._color = color;
    }

    override draw(ctx: CanvasRenderingContext2D): void {
        ctx.font = this._font;
        ctx.fillStyle = this._color;
        ctx.fillText(
            this._text,
            this.canvasPosition.x,
            this.canvasPosition.y + this.size.height
        );
    }

    setText(text: string): void {
        let changed = this._text !== text;
        this._text = text;
        this.redraw(changed);
    }

    setFont(font: string): void {
        let changed = this._font !== font;
        this._font = font;
        this.redraw(changed);
    }

    setColor(color: string): void {
        let changed = this._color !== color;
        this._color = color;
        this.redraw(changed);
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
}
