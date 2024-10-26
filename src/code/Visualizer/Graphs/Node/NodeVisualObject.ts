import { BorderConfig } from "./BorderConfig";
import { DraggableVisualObject } from "./DraggableVisualObject";
import { VisualObject } from "./VisualObject";

export class NodeVisualObject extends DraggableVisualObject {
    private border: BorderConfig;
    private content: VisualObject;
    private backgroundColor: string;

    constructor(
        realPosition: TPoint,
        size: TSize,
        border: BorderConfig,
        content: VisualObject,
        backgroundColor: string = "#ffffff",
        zIndex: number = 0
    ) {
        super(realPosition, size, zIndex);

        // Initially same as real position
        this.border = border;
        this.content = content;
        this.backgroundColor = backgroundColor;
    }

    draw(ctx: CanvasRenderingContext2D): void {

        // Draw background
        ctx.fillStyle = this.backgroundColor;
        ctx.beginPath();
        if (this.border.radius) {
            ctx.roundRect(
                this.canvasPosition.x,
                this.canvasPosition.y,
                this.size.width,
                this.size.height,
                this.border.radius
            );
        } else {
            ctx.rect(
                this.canvasPosition.x,
                this.canvasPosition.y,
                this.size.width,
                this.size.height
            );
        }
        ctx.fill();

        // Draw border
        ctx.strokeStyle = this.border.color;
        ctx.lineWidth = this.border.width;
        if (this.border.style === "dashed") {
            ctx.setLineDash([5, 5]);
        } else if (this.border.style === "dotted") {
            ctx.setLineDash([2, 2]);
        } else {
            ctx.setLineDash([]);
        }
        ctx.stroke();

        // Draw content
        this.content.draw(ctx);
    }

    drag(point: TPoint): void {
        super.drag(point);

        // Update content position maintaining the offset
        const newContentPosition = this.getContentPosition();
        
        this.content.setRealPosition(newContentPosition);
    }

    getContentPosition(): TPoint {
        return {
            x: this.canvasPosition.x + this.size.width / 2 - this.content.getSize().width / 2,
            y: this.canvasPosition.y + this.size.height / 2 - this.content.getSize().height / 2
        }
    }



    getContent(): VisualObject {
        return this.content;
    }
    
    
    getBorder(): BorderConfig {
        return this.border;
    }
    
    setContent(content: VisualObject): void {
        let change = this.content !== content;
        this.content = content;
        this.redraw(change);
    }

    setBorder(border: BorderConfig): void {
        let change = this.border !== border;
        this.border = border;
        this.redraw(change);
    }

    setBackgroundColor(backgroundColor: string): void {
        let change = this.backgroundColor !== backgroundColor;
        this.backgroundColor = backgroundColor;
        this.redraw(change);
    }
}