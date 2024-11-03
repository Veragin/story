import { throttle } from 'code/utils/throttle';
import { ClickableVisualObject } from './Node/ClickableVisualObject';
import { DraggableVisualObject } from './Node/DraggableVisualObject';
import { HoverableVisualObject } from './Node/HoverableVisualObject';
import { VisualObject } from './Node/VisualObject';
import { assertNotNullish } from 'code/utils/typeguards';
import { RESOLUTION_FACTOR } from '../ts/TimelineRender/constants';
import { Observer } from 'code/utils/Observer';

export class CanvasManager {
    readonly canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;

    // Visual objects with insertion order
    private visualObjects: Map<VisualObject, number> = new Map();
    private hoveredObjects: Set<HoverableVisualObject> = new Set();
    private nextInsertionOrder: number = 0;
    private draggedObject: DraggableVisualObject | null = null;
    readonly onCanvasResize = new Observer<TSize>();

    get canvasSize(): TSize {
        return { width: this.canvas.width, height: this.canvas.height };
    }

    dragMode = true;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        const context = canvas.getContext('2d');
        assertNotNullish(context);
        this.ctx = context;
        this.ctx.scale(RESOLUTION_FACTOR, RESOLUTION_FACTOR);

        // Add event listeners
        this.canvas.addEventListener('mousemove', this.handleMouseMove);
        this.canvas.addEventListener('mousedown', this.handleMouseDown);
        this.canvas.addEventListener('mouseup', this.handleMouseUp);
        this.canvas.addEventListener('mouseleave', this.handleMouseUp);
        this.canvas.addEventListener('dblclick', this.handleMouseClick);
        this.canvas.addEventListener('contextmenu', this.handleContextMenu);
        this.canvas.addEventListener('resize', this.handleResize);
    }

    private handleResize = () => {
        this.onCanvasResize.notify({ 
            width: this.canvas.width, 
            height: this.canvas.height 
        });
    }

    private getMousePoint(event: MouseEvent): TPoint {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
        };
    }

    private handleMouseDown = (event: MouseEvent) => {
        if (!this.dragMode) return;

        const point = this.getMousePoint(event);
        const objectsAtPoint = this.getTopObjectsAtPoint(point);

        if (event.button === 0) {
            // Find the topmost draggable object
            const draggableObject = objectsAtPoint.find((obj) => isDraggableObject(obj) && obj.isDraggable()) as
                | DraggableVisualObject
                | undefined;

            if (draggableObject) {
                this.draggedObject = draggableObject;
                draggableObject.startDrag(point);

                // Increase z-index while dragging // TODO maybe just set to max z-index
                const currentZIndex = draggableObject.zIndex;
                const highestZIndex = Math.max(...Array.from(this.visualObjects.keys()).map((obj) => obj.zIndex));
                if (currentZIndex <= highestZIndex) {
                    draggableObject.setZIndex(highestZIndex + 1);
                }
            }
        }

        // Handle right button down events
        if (event.button === 2) {
            Array.from(this.visualObjects)
                .reverse()
                .forEach((obj) => {
                    if (isClickableObject(obj[0])) {
                        obj[0].handleRightDown(point);
                    }
                });
        }

    };

    private handleMouseMove = (event: MouseEvent) => {
        const point = this.getMousePoint(event);

        // Handle dragging
        if (this.draggedObject && this.dragMode) {
            this.draggedObject.drag(point);
            return;
        }

        // Handle regular hover
        const hoveredObjectsThisFrame = new Set<HoverableVisualObject>();

        // Get objects at point, sorted by z-index (top to bottom)
        const objectsAtPoint = this.getTopObjectsAtPoint(point);

        // Handle hover events
        for (const obj of this.visualObjects.keys()) {
            if (isHoverableObject(obj)) {
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
    };

    private handleMouseClick = (event: MouseEvent) => {
        const point = this.getMousePoint(event);
        event.preventDefault();

        if (this.draggedObject) {
            return;
        }

        // Handle clicks in reverse order (top-most object first)
        Array.from(this.visualObjects)
            .reverse()
            .forEach((obj) => {
                if (isClickableObject(obj[0])) {
                    obj[0].handleClick(point);
                }
            });
    }

    private handleMouseUp = (event: MouseEvent) => {
        if (this.draggedObject) {
            const point = this.getMousePoint(event);
            this.draggedObject.endDrag(point);
            this.draggedObject = null;
        }
    };


    private handleContextMenu = (event: MouseEvent) => {
        event.preventDefault();
        return false;
    };


    private handleVisualObjectChange = () => {
        this.draw();
    };

    private getTopObjectsAtPoint = (point: TPoint): VisualObject[] => {
        return this.getSortedObjects()
            .filter((obj) => isHoverableObject(obj) && obj.isPointInside(point))
            .reverse(); // Reverse to get top-most objects first
    };

    private getSortedObjects = (): VisualObject[] => {
        return Array.from(this.visualObjects.keys()).sort((a, b) => {
            // First compare by z-index
            if (a.zIndex !== b.zIndex) {
                return a.zIndex - b.zIndex;
            }
            // If z-index is the same, use insertion order
            return (this.visualObjects.get(a) ?? 0) - (this.visualObjects.get(b) ?? 0);
        });
    };

    addObject = (obj: VisualObject) => {
        this.visualObjects.set(obj, this.nextInsertionOrder++);
        obj.onPropertyChanged.subscribe(this.handleVisualObjectChange);
        this.draw();
    };

    removeObject = (obj: VisualObject) => {
        this.visualObjects.delete(obj);
        obj.onPropertyChanged.unsubscribe(this.handleVisualObjectChange);
        this.draw();
    };

    clear = () => {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    };

    draw = throttle(() => {
        this.clear();
        const sortedObjects = this.getSortedObjects();
        for (const obj of sortedObjects) {
            if (!this.isObjVisible(obj)) continue;
            obj.draw(this.ctx);
        }
    }, 1000 / 60);

    private isObjVisible = (obj: VisualObject): boolean => {
        const pos = obj.getPosition();
        const size = obj.getSize();

        return (
            pos.x + size.width >= 0 &&
            pos.x <= this.canvas.width &&
            pos.y + size.height >= 0 &&
            pos.y <= this.canvas.height
        );
    };

    destroy = () => {
        // Clean up event listeners
        this.canvas.removeEventListener('mousemove', this.handleMouseMove);
        this.canvas.removeEventListener('mousedown', this.handleMouseDown);
        this.canvas.removeEventListener('mouseup', this.handleMouseUp);
        this.canvas.removeEventListener('mouseleave', this.handleMouseUp);
        this.canvas.removeEventListener('dblclick', this.handleMouseClick);
        this.canvas.removeEventListener('contextmenu', this.handleContextMenu);

        // Clean up object subscriptions
        for (const obj of this.visualObjects) {
            obj[0].onPropertyChanged.unsubscribe(this.handleVisualObjectChange);
        }

        // Clear objects
        this.visualObjects.clear();
        this.hoveredObjects.clear();
        this.draggedObject = null;
    };

    getHeight(): number | undefined {
        return this.canvas.height;
    }

    getWidth(): number | undefined {
        return this.canvas.width;
    }
}

const isDraggableObject = (obj: any): obj is DraggableVisualObject => {
    return 'isDragging' in obj && 'isDraggable' in obj;
};

const isHoverableObject = (obj: any): obj is HoverableVisualObject => {
    return 'handleHover' in obj && 'isHovered' in obj;
};

const isClickableObject = (obj: VisualObject): obj is ClickableVisualObject => {
    return 'handleClick' in obj && 'isClickable' in obj;
};
