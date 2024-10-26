import { Point } from "../Point";
import { DragStrategy } from "./DragStrategy";



export class HorizontalDragStrategy implements DragStrategy {
    calculatePosition(params: {
        point: Point;
        mouseOffset: Point;
        startPosition: Point;
        currentPosition: Point;
    }): Point {
        return {
            x: params.point.x - params.mouseOffset.x,
            y: params.startPosition.y
        };
    }
}
