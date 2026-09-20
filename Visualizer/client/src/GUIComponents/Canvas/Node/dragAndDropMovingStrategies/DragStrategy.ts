import { TPoint } from '@story/types';

export type DragStrategy = {
    calculatePosition(params: {
        point: TPoint,
        mouseOffset: TPoint,
        startPosition: TPoint,
        currentPosition: TPoint
    }): TPoint;
}