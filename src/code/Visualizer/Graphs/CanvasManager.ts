import { ClickableVisualObject } from "./Node/ClickableVisualObject";
import { DraggableVisualObject } from "./Node/DraggableVisualObject";
import { HoverableVisualObject } from "./Node/HoverableVisualObject";
import { Point } from "./Node/Point";
import { VisualObject } from "./Node/VisualObject";

export class CanvasManager {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;

    // Visual objects with insertion order
    private visualObjects: Map<VisualObject, number> = new Map();
    private hoveredObjects: Set<HoverableVisualObject> = new Set();
    private nextInsertionOrder: number = 0;
    private draggedObject: DraggableVisualObject | null = null;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        const context = canvas.getContext('2d');
        if (!context) {
            throw new Error('Could not get canvas context');
        }
        this.ctx = context;

        // Bind event handlers
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseDown = this.handleMouseDown.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);
        this.handleMouseClick = this.handleMouseClick.bind(this);

        // Add event listeners
        this.canvas.addEventListener('mousemove', this.handleMouseMove);
        this.canvas.addEventListener('mousedown', this.handleMouseDown);
        this.canvas.addEventListener('mouseup', this.handleMouseUp);
        this.canvas.addEventListener('mouseleave', this.handleMouseUp);
        this.canvas.addEventListener('click', this.handleMouseClick);


        // Subscribe to visual object changes
        this.handleVisualObjectChange = this.handleVisualObjectChange.bind(this);
    }

    private getMousePoint(event: MouseEvent): Point {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
        };
    }

    private handleMouseDown(event: MouseEvent): void {
        const point = this.getMousePoint(event);
        const objectsAtPoint = this.getTopObjectsAtPoint(point);

        // Find the topmost draggable object
        const draggableObject = objectsAtPoint.find(obj =>
            this.isDraggableObject(obj) && obj.isDraggable()
        ) as DraggableVisualObject | undefined;

        if (draggableObject) {
            this.draggedObject = draggableObject;
            draggableObject.startDrag(point);

            // Increase z-index while dragging // TODO maybe just set to max z-index
            const currentZIndex = draggableObject.zIndex;
            const highestZIndex = Math.max(...Array.from(this.visualObjects.keys()).map(obj => obj.zIndex));
            if (currentZIndex <= highestZIndex) {
                draggableObject.setZIndex(highestZIndex + 1);
            }
        }
    }

    private isDraggableObject(obj: any): obj is DraggableVisualObject {
        return 'isDragging' in obj && 'isDraggable' in obj;
    }


    private handleMouseMove(event: MouseEvent): void {
        const point = this.getMousePoint(event);

        // Handle dragging
        if (this.draggedObject) {
            this.draggedObject.drag(point);
            return;
        }

        // Handle regular hover
        const hoveredObjectsThisFrame = new Set<HoverableVisualObject>();

        // Get objects at point, sorted by z-index (top to bottom)
        const objectsAtPoint = this.getTopObjectsAtPoint(point);

        // Handle hover events
        for (const obj of this.visualObjects.keys()) {
            if (this.isHoverableObject(obj)) {
                const isTopMost = objectsAtPoint[0] === obj;
                if (isTopMost && obj.isPointInside(point)) {
                    obj.handleHover(point);
                    if (obj.isHovered()) {
                        hoveredObjectsThisFrame.add(obj);
                    }
                } else {
                    // Force hover exit if not top-most
                    if (obj.isHovered()) {
                        obj.handleHover({ x: -1, y: -1 }); // Force exit
                    }
                }
            }
        }

        // Update hovered objects set
        this.hoveredObjects = hoveredObjectsThisFrame;
    }

    private handleMouseClick(event: MouseEvent): void {
        const point = this.getMousePoint(event);

        if(this.draggedObject) {
            return;
        }
        
        // Handle clicks in reverse order (top-most object first)
        Array.from(this.visualObjects)
            .reverse()
            .forEach(obj => {
                if (this.isClickableObject(obj[0])) {
                    obj[0].handleClick(point);
                }
            });
    }

    private isClickableObject(obj: VisualObject): obj is ClickableVisualObject {
        return 'handleClick' in obj && 'isClickable' in obj;
    }

    private handleMouseUp(event: MouseEvent): void {
        if (this.draggedObject) {
            const point = this.getMousePoint(event);
            this.draggedObject.endDrag(point);
            this.draggedObject = null;
        }
    }

    private getTopObjectsAtPoint(point: Point): VisualObject[] {
        return this.getSortedObjects()
            .filter(obj => {
                if (this.isHoverableObject(obj)) {
                    return obj.isPointInside(point);
                }
                return false;
            })
            .reverse(); // Reverse to get top-most objects first
    }

    private getSortedObjects(): VisualObject[] {
        return Array.from(this.visualObjects.keys()).sort((a, b) => {
            // First compare by z-index
            if (a.zIndex !== b.zIndex) {
                return a.zIndex - b.zIndex;
            }
            // If z-index is the same, use insertion order
            return (this.visualObjects.get(a) ?? 0) - (this.visualObjects.get(b) ?? 0);
        });
    }

    private handleVisualObjectChange(): void {
        this.draw();
    }

    private isHoverableObject(obj: any): obj is HoverableVisualObject {
        return 'handleHover' in obj && 'isHovered' in obj;
    }

    addObject(obj: VisualObject): void {
        this.visualObjects.set(obj, this.nextInsertionOrder++);
        obj.onPropertyChanged.subscribe(this.handleVisualObjectChange);
        this.draw();
    }

    removeObject(obj: VisualObject): void {
        this.visualObjects.delete(obj);
        obj.onPropertyChanged.unsubscribe(this.handleVisualObjectChange);
        this.draw();
    }

    clear(): void {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    draw(): void {
        this.clear();
        // Draw objects in z-index order
        const sortedObjects = this.getSortedObjects();
        for (const obj of sortedObjects) {
            obj.draw(this.ctx);
        }
    }

    destroy(): void {
        // Clean up event listeners
        this.canvas.removeEventListener('mousemove', this.handleMouseMove);
        this.canvas.removeEventListener('mousedown', this.handleMouseDown);
        this.canvas.removeEventListener('mouseup', this.handleMouseUp);
        this.canvas.removeEventListener('mouseleave', this.handleMouseUp);

        // Clean up object subscriptions
        for (const obj of this.visualObjects) {
            obj[0].onPropertyChanged.unsubscribe(this.handleVisualObjectChange);
        }

        // Clear objects
        this.visualObjects.clear();
        this.hoveredObjects.clear();
        this.draggedObject = null;
    }

    setSize(width: number, height: number): void {
        this.canvas.width = width;
        this.canvas.height = height;
        this.draw();
    }
}