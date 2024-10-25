import { Point } from "./Point";
import { Size } from "./Size";
import { VisualObject } from "./VisualObject";

/**
 * Example implementation of a visual object
 */
export class TextContent extends VisualObject {
    private text: string;
    private font: string;
    private color: string;

    constructor(
        position: Point,
        size: Size,
        text: string,
        font: string = "14px Arial",
        color: string = "#000000"
    ) {
        super(position, size);
        this.text = text;
        this.font = font;
        this.color = color;
    }

    draw(ctx: CanvasRenderingContext2D): void {
        ctx.font = this.font;
        ctx.fillStyle = this.color;
        ctx.fillText(
            this.text,
            this.canvasPosition.x,
            this.canvasPosition.y + this.size.height
        );
    }

    setText(text: string): void {
        let changed = this.text !== text;
        this.text = text;
        this.redraw(changed);
    }

    setFont(font: string): void {
        let changed = this.font !== font;
        this.font = font;
        this.redraw(changed);
    }

    setColor(color: string): void {
        let changed = this.color !== color;
        this.color = color;
        this.redraw(changed);
    }
}
