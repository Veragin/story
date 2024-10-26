import { Observer } from "code/Visualizer/Observer";
import { ClickableVisualObject } from "./ClickableVisualObject";
import { DragStrategy } from "./dragAndDropMovingStrategies/DragStrategy";
import { FreeDragStrategy } from "./dragAndDropMovingStrategies/FreeDragStrategy";

export type DragStartEvent = {
    object: DraggableVisualObject;
    startPosition: TPoint;
    mouseOffset: TPoint;
}

export type DragMoveEvent = {
    object: DraggableVisualObject;
    currentPosition: TPoint;
    startPosition: TPoint;
    mouseOffset: TPoint;
}

export type DragEndEvent = {
    object: DraggableVisualObject;
    finalPosition: TPoint;
    startPosition: TPoint;
}

export abstract class DraggableVisualObject extends ClickableVisualObject {
    private _isDragging: boolean = false;
    private _isDraggable: boolean = true;
    private _dragStartPosition: TPoint | null = null;
    private _mouseOffset: TPoint = { x: 0, y: 0 };
    private _dragStrategy: DragStrategy;

    private _onDragStart = new Observer<DragStartEvent>();
    private _onDragMove = new Observer<DragMoveEvent>();
    private _onDragEnd = new Observer<DragEndEvent>();

    get onDragStart(): Observer<DragStartEvent> {
        return this._onDragStart;
    }

    get onDragMove(): Observer<DragMoveEvent> {
        return this._onDragMove;
    }

    get onDragEnd(): Observer<DragEndEvent> {
        return this._onDragEnd;
    }

    constructor(
        realPosition: TPoint,
        size: TSize,
        zIndex: number = 0
    ) {
        super(realPosition, size, zIndex);
        this._dragStrategy = new FreeDragStrategy();
    }

    isDragging(): boolean {
        return this._isDragging;
    }

    isDraggable(): boolean {
        return this._isDraggable;
    }

    setDragStrategy(strategy: DragStrategy): void {
        this._dragStrategy = strategy;
    }

    getDragStrategy(): DragStrategy {
        return this._dragStrategy;
    }

    setDraggable(draggable: boolean): void {
        this._isDraggable = draggable;
        if (!draggable && this._isDragging) {
            this.endDrag(this.canvasPosition);
        }
    }

    startDrag(point: TPoint): void {
        if (!this._isDraggable) return;

        this._isDragging = true;
        this._dragStartPosition = { ...this.canvasPosition };

        // Calculate offset between mouse position and object position
        this._mouseOffset = {
            x: point.x - this.canvasPosition.x,
            y: point.y - this.canvasPosition.y
        };

        this._onDragStart.notify({
            object: this,
            startPosition: { ...this.canvasPosition },
            mouseOffset: { ...this._mouseOffset }
        });
    }

    drag(point: TPoint): void {
        if (!this._isDragging || !this._isDraggable)
            return;

        const newPosition = this._dragStrategy.calculatePosition({
            point,
            mouseOffset: this._mouseOffset,
            startPosition: this._dragStartPosition!,
            currentPosition: this.canvasPosition
        });

        this.setCanvasPosition(newPosition);

        this._onDragMove.notify({
            object: this,
            currentPosition: { ...newPosition },
            startPosition: { ...this._dragStartPosition! },
            mouseOffset: { ...this._mouseOffset }
        });
    }

    endDrag(point: TPoint): void {
        if (!this._isDragging) return;

        this._isDragging = false;
        const finalPosition = this._dragStrategy.calculatePosition({
            point,
            mouseOffset: this._mouseOffset,
            startPosition: this._dragStartPosition!,
            currentPosition: this.canvasPosition
        });

        this.setCanvasPosition(finalPosition);

        this._onDragEnd.notify({
            object: this,
            finalPosition: { ...finalPosition },
            startPosition: { ...this._dragStartPosition! }
        });

        this._dragStartPosition = null;
    }
}