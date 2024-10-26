
export interface DragStrategy {
    calculatePosition(params: {
        point: TPoint,
        mouseOffset: TPoint,
        startPosition: TPoint,
        currentPosition: TPoint
    }): TPoint;
}