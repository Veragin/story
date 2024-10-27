import { BorderConfig } from "./BorderConfig";
import { DraggableVisualObject } from "./DraggableVisualObject";
import { TVisualObjectPropertyChangeArgs, VisualObject, visualObjectProperties } from "./VisualObject";

export const nodeVisualObjectProperties = {
    border: "border",
    backgroundColor: "backgroundColor",
    ...visualObjectProperties
};

export class NodeVisualObject extends DraggableVisualObject {
    private border: BorderConfig;
    private content: VisualObject;
    private backgroundColor: string;
    private id: string;
    private static idCounter: number = 0;


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
        this.id = `node-${NodeVisualObject.idCounter++}`;

        // Set content position when node position changes
        const updateContentPosition = (args: TVisualObjectPropertyChangeArgs) => {
            if (args.property === nodeVisualObjectProperties.CanvasPosition) {
                // Update content position maintaining the offset
                const newContentPosition = this.getContentPosition();
                this.content.setRealPosition(newContentPosition);
            }
        };
        this.onPropertyChanged.subscribe(updateContentPosition);

        // TODO: Add setContent method, unsubscribe and subcribe to content position 
        // of the new content object
    }

    override draw(ctx: CanvasRenderingContext2D): void {
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

    setBorder(border: BorderConfig): void {
        let change = this.border !== border;
        this.border = border;
        this.redraw(change, nodeVisualObjectProperties.border);
    }

    setBackgroundColor(backgroundColor: string): void {
        let change = this.backgroundColor !== backgroundColor;
        this.backgroundColor = backgroundColor;
        this.redraw(change, nodeVisualObjectProperties.backgroundColor);
    }

    getId(): string {
        return this.id;
    }
}