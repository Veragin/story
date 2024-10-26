import { TPoint } from "../Point";
import { DragStrategy } from "./DragStrategy";



export class HorizontalDragStrategy implements DragStrategy {
    calculatePosition(params: {
        point: TPoint;
        mouseOffset: TPoint;
        startPosition: TPoint;
        currentPosition: TPoint;
    }): TPoint {
        return {
            x: params.point.x - params.mouseOffset.x,
            y: params.startPosition.y
        };
    }
}
