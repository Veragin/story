import { Observer } from "code/Visualizer/Observer";
import { ClickableVisualObject } from "./ClickableVisualObject";
import { Point } from "./Point";
import { Size } from "./Size";

export interface DragStartEvent {
    object: DraggableVisualObject;
    startPosition: Point;
    mouseOffset: Point;
}

export interface DragMoveEvent {
    object: DraggableVisualObject;
    currentPosition: Point;
    startPosition: Point;
    mouseOffset: Point;
}

export interface DragEndEvent {
    object: DraggableVisualObject;
    finalPosition: Point;
    startPosition: Point;
}

export abstract class DraggableVisualObject extends ClickableVisualObject {
    private _isDragging: boolean = false;
    private _isDraggable: boolean = true;
    private _dragStartPosition: Point | null = null;
    private _mouseOffset: Point = { x: 0, y: 0 };
    
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
    
    constructor(realPosition: Point, size: Size, zIndex: number = 0) {
        super(realPosition, size, zIndex);
    }
    
    isDragging(): boolean {
        return this._isDragging;
    }
    
    isDraggable(): boolean {
        return this._isDraggable;
    }
    
    setDraggable(draggable: boolean): void {
        this._isDraggable = draggable;
        if (!draggable && this._isDragging) {
            this.endDrag(this.canvasPosition);
        }
    }
    
    startDrag(point: Point): void {
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
    
    drag(point: Point): void {
        if (!this._isDragging || !this._isDraggable) return;
        
        const newPosition = {
            x: point.x - this._mouseOffset.x,
            y: point.y - this._mouseOffset.y
        };
        
        this.setCanvasPosition(newPosition);
        
        this._onDragMove.notify({
            object: this,
            currentPosition: { ...newPosition },
            startPosition: { ...this._dragStartPosition! },
            mouseOffset: { ...this._mouseOffset }
        });
    }
    
    endDrag(point: Point): void {
        if (!this._isDragging) return;
        
        this._isDragging = false;
        const finalPosition = {
            x: point.x - this._mouseOffset.x,
            y: point.y - this._mouseOffset.y
        };
        
        this.setCanvasPosition(finalPosition);
        
        this._onDragEnd.notify({
            object: this,
            finalPosition: { ...finalPosition },
            startPosition: { ...this._dragStartPosition! }
        });
        
        this._dragStartPosition = null;
    }
}