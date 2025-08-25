import { CanvasManagerBase } from "./CanvasManagerCore";

export class StaticCanvasManager extends CanvasManagerBase {
    
    constructor(canvas: HTMLCanvasElement) {
        super(canvas);
        
        // Disable wheel events to prevent scrolling/zooming
        this.canvas.addEventListener('wheel', (event) => {
            event.preventDefault();
        }, { passive: false });
    }

    protected screenToWorld(screenPoint: TPoint): TPoint {
        return { ...screenPoint };
    }

    protected worldToScreen(worldPoint: TPoint): TPoint {
        return { ...worldPoint };
    }

    protected applyViewportTransformation(ctx: CanvasRenderingContext2D): void {
        // No transformation needed for static canvas
    }

    protected getVisibleBounds(): { min: TPoint; max: TPoint } {
        // Return the entire canvas area as visible bounds
        return {
            min: { x: 0, y: 0 },
            max: { x: this.canvas.width, y: this.canvas.height }
        };
    }

    // Override mouse event handlers to prevent any viewport manipulation
    protected onMouseDownPre(event: MouseEvent, screenPoint: TPoint, worldPoint: TPoint): boolean {
        // Never handle the event for panning/zooming in static canvas
        return false;
    }

    protected onMouseMovePre(event: MouseEvent, screenPoint: TPoint): boolean {
        // Never handle the event for panning/zooming in static canvas
        return false;
    }
}