import { DragStrategy } from "./DragStrategy";


export class VerticalDragStrategy implements DragStrategy {
    calculatePosition(params: {
        point: TPoint;
        mouseOffset: TPoint;
        startPosition: TPoint;
        currentPosition: TPoint;
    }): TPoint {
        return {
            x: params.startPosition.x,
            y: params.point.y - params.mouseOffset.y
        };
    }
}
