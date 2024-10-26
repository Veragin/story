import { Point } from "../Point";
import { DragStrategy } from "./DragStrategy";


export class VerticalDragStrategy implements DragStrategy {
    calculatePosition(params: {
        point: Point;
        mouseOffset: Point;
        startPosition: Point;
        currentPosition: Point;
    }): Point {
        return {
            x: params.startPosition.x,
            y: params.point.y - params.mouseOffset.y
        };
    }
}
