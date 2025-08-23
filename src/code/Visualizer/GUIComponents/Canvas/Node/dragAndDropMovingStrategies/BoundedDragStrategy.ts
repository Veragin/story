import { DragStrategy } from "./DragStrategy";

/**
 * BoundedDragStrategy is a strategy that keeps the object within specified bounds.
 */
export class BoundedDragStrategy implements DragStrategy {
    private bounds: {
        minX: number;
        maxX: number;
        minY: number;
        maxY: number;
    };

    constructor(bounds: { minX: number; maxX: number; minY: number; maxY: number; }) {
        this.bounds = bounds;
    }

    calculatePosition(params: {
        point: TPoint;
        mouseOffset: TPoint;
        startPosition: TPoint;
        currentPosition: TPoint;
    }): TPoint {
        const rawX = params.point.x - params.mouseOffset.x;
        const rawY = params.point.y - params.mouseOffset.y;

        return {
            x: Math.max(this.bounds.minX, Math.min(this.bounds.maxX, rawX)),
            y: Math.max(this.bounds.minY, Math.min(this.bounds.maxY, rawY))
        };
    }
}
