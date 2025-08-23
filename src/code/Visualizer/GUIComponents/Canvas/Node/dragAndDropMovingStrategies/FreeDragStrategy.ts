import { DragStrategy } from "./DragStrategy";

export class FreeDragStrategy implements DragStrategy {
    calculatePosition(params: {
        point: TPoint,
        mouseOffset: TPoint,
        startPosition: TPoint,
        currentPosition: TPoint
    }): TPoint {
        return {
            x: params.point.x - params.mouseOffset.x,
            y: params.point.y - params.mouseOffset.y
        };
    }
}