import { DragStrategy } from "./DragStrategy";

/**
 * GridDragStrategy is a strategy that snaps the object to a grid.
 * The grid size is specified in the constructor.
 */

export class GridDragStrategy implements DragStrategy {
    private gridSize: number;

    constructor(gridSize: number = 20) {
        this.gridSize = gridSize;
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
            x: Math.round(rawX / this.gridSize) * this.gridSize,
            y: Math.round(rawY / this.gridSize) * this.gridSize
        };
    }
}
