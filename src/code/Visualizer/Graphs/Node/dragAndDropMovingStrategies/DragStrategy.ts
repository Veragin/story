import { Point } from "../Point";

export interface DragStrategy {
    calculatePosition(params: {
        point: Point,
        mouseOffset: Point,
        startPosition: Point,
        currentPosition: Point
    }): Point;
}