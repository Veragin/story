// CanvasManagerBase.ts
import { throttle } from 'code/utils/throttle';
import { ClickableVisualObject } from '../Node/ClickableVisualObject';
import { DraggableVisualObject } from '../Node/DraggableVisualObject';
import { HoverableVisualObject } from '../Node/HoverableVisualObject';
import { VisualObject } from '../Node/VisualObject';
import { assertNotNullish } from 'code/utils/typeguards';
import { RESOLUTION_FACTOR } from '../../../Chapters/ChapterStore/TimelineRender/constants';
import { ConditionalObserver, Observer } from 'code/utils/Observer';
import { CanvasWorld } from './CanvasWorld';
import { VisibleVisualObjectsManager, IVisibleVisualObjectsManager, IVisibilityProvider } from './VisibleObjectsManager';

/**
 * Base class containing common visual object management functionality
 * Subclasses handle coordinate transformations and viewport management
 */
export abstract class CanvasManagerBase implements IVisibilityProvider {
    readonly canvas: HTMLCanvasElement;
    protected ctx: CanvasRenderingContext2D;
    public readonly canvasWorld: CanvasWorld;
    public readonly visibleVisualObjectsManager: IVisibleVisualObjectsManager;

    // Visual objects with insertion order
    protected visualObjects: Map<VisualObject, number> = new Map();
    protected hoveredObjects: Set<HoverableVisualObject> = new Set();
    protected nextInsertionOrder: number = 0;
    protected draggedObject: DraggableVisualObject | null = null;

    public readonly onObjectAdded = new Observer<VisualObject>();
    public readonly onObjectRemoved = new Observer<VisualObject>();
    public readonly onObjectPropertyChanged = new Observer<{ object: VisualObject, property: string }>();

    readonly onCanvasResize = new ConditionalObserver<TSize>(
        (lastSize, newSize) => {
            if (!lastSize || !newSize) return false;
            return lastSize.width !== newSize.width || lastSize.height !== newSize.height;
        }
    );

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

        this.canvasWorld = new CanvasWorld();
        this.visibleVisualObjectsManager = new VisibleVisualObjectsManager(this.canvasWorld, this);
        this.visibleVisualObjectsManager.onVisibleObjectsChanged.subscribe(() => this.draw());

        this.canvasWorld.onViewPositionChange.subscribe(() => this.draw());
        this.canvasWorld.onPixelSizeChange.subscribe(() => this.draw());

        this.canvas.addEventListener('mousemove', this.handleMouseMove);
        this.canvas.addEventListener('mousedown', this.handleMouseDown);
        this.canvas.addEventListener('mouseup', this.handleMouseUp);
        this.canvas.addEventListener('mouseleave', this.handleMouseUp);
        this.canvas.addEventListener('click', this.handleMouseClick);
        this.canvas.addEventListener('dblclick', this.handleMouseDbClick);
        this.canvas.addEventListener('contextmenu', this.handleContextMenu);

        this.canvas.addEventListener('resize', () => {
            this.onCanvasResize.notify(this.canvasSize);
            this.visibleVisualObjectsManager.setCanvasSize(this.canvasSize);
            console.log('Canvas resized:', this.canvasSize);
            this.draw();
        });
    }

    getAllObjects(): Iterable<VisualObject> {
        return this.visualObjects.keys();
    }

    getCanvasSize(): TSize {
        return this.canvasSize;
    }

    protected abstract applyViewportTransformation(ctx: CanvasRenderingContext2D): void;

    protected getMousePoint = (event: MouseEvent): TPoint => {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
        };
    }

    protected handleMouseDown = (event: MouseEvent) => {
        const screenPoint = this.getMousePoint(event);
        const worldPoint = this.canvasWorld.screenToWorld(screenPoint);

        // Let subclass handle additional mouse down logic (like panning)
        if (this.onMouseDownPre(event, screenPoint, worldPoint)) {
            return; // Subclass handled the event
        }

        if (!this.dragMode) return;

        const objectsAtPoint = this.getTopObjectsAtVisiblePoint(worldPoint);

        if (event.button === 0) {
            // Find the topmost draggable object
            const draggableObject = objectsAtPoint.find((obj) =>
                isDraggableObject(obj) && obj.isDraggable()
            ) as DraggableVisualObject | undefined;

            if (draggableObject) {
                this.draggedObject = draggableObject;
                draggableObject.startDrag(worldPoint);

                // Increase z-index while dragging
                const currentZIndex = draggableObject.zIndex;
                const highestZIndex = Math.max(
                    ...Array.from(this.visualObjects.keys()).map((obj) => obj.zIndex)
                );
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
                        obj[0].handleRightDown(worldPoint);
                    }
                });
        }
    };

    protected handleMouseMove = (event: MouseEvent) => {
        const screenPoint = this.getMousePoint(event);

        // Let subclass handle additional mouse move logic (like panning)
        if (this.onMouseMovePre(event, screenPoint)) {
            return; // Subclass handled the event
        }

        const worldPoint = this.canvasWorld.screenToWorld(screenPoint);

        // Handle dragging
        if (this.draggedObject && this.dragMode) {
            this.draggedObject.drag(worldPoint);
            return;
        }

        // Handle regular hover
        const hoveredObjectsThisFrame = new Set<HoverableVisualObject>();
        const objectsAtPoint = this.getTopObjectsAtVisiblePoint(worldPoint);

        // Handle hover events
        for (const obj of this.visualObjects.keys()) {
            if (isHoverableObject(obj)) {
                const isTopMost = objectsAtPoint[0] === obj;
                if (isTopMost && obj.isPointInside(worldPoint)) {
                    obj.handleHover(worldPoint);
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

    protected handleMouseClick = (event: MouseEvent) => {
        const screenPoint = this.getMousePoint(event);
        const worldPoint = this.canvasWorld.screenToWorld(screenPoint);
        event.preventDefault();

        // Let subclass handle additional logic
        if (this.onMouseClickPre(event, screenPoint, worldPoint)) {
            return; // Subclass handled the event
        }

        if (this.draggedObject) {
            return;
        }

        // Handle clicks in reverse order (top-most object first)
        Array.from(this.visualObjects)
            .reverse()
            .forEach((obj) => {
                if (isClickableObject(obj[0])) {
                    obj[0].handleClick(worldPoint);
                }
            });
    };

    protected handleMouseDbClick = (event: MouseEvent) => {
        const screenPoint = this.getMousePoint(event);
        const worldPoint = this.canvasWorld.screenToWorld(screenPoint);
        event.preventDefault();

        if (this.draggedObject) {
            return;
        }

        // Handle double clicks in reverse order (top-most object first)
        Array.from(this.visualObjects)
            .reverse()
            .forEach((obj) => {
                if (isClickableObject(obj[0])) {
                    obj[0].handleDbClick(worldPoint);
                }
            });
    };

    protected handleMouseUp = (event: MouseEvent) => {
        const screenPoint = this.getMousePoint(event);
        const worldPoint = this.canvasWorld.screenToWorld(screenPoint);

        // Let subclass handle additional logic (like ending pan)
        this.onMouseUpPre(event, screenPoint, worldPoint);

        if (this.draggedObject) {
            this.draggedObject.endDrag(worldPoint);
            this.draggedObject = null;
        }
    };

    protected handleContextMenu = (event: MouseEvent) => {
        event.preventDefault();
        return false;
    };

    // Hooks for subclasses to add their own behavior
    // Return true if the subclass handled the event and no further processing should occur
    protected onMouseDownPre(event: MouseEvent, screenPoint: TPoint, worldPoint: TPoint): boolean {
        return false;
    }

    protected onMouseMovePre(event: MouseEvent, screenPoint: TPoint): boolean {
        return false;
    }

    protected onMouseClickPre(event: MouseEvent, screenPoint: TPoint, worldPoint: TPoint): boolean {
        return false;
    }

    protected onMouseUpPre(event: MouseEvent, screenPoint: TPoint, worldPoint: TPoint): void {
        // Default implementation does nothing
    }

    private handleVisualObjectChange = (args: { property: string; VisualObject: VisualObject }) => {
        this.onObjectPropertyChanged.notify({
            object: args.VisualObject,
            property: args.property
        });
        this.draw();
    };

    protected getTopObjectsAtVisiblePoint = (worldPoint: TPoint): VisualObject[] => {
        return this.sortVisualObjectsByZIndex(this.visibleVisualObjectsManager.getVisibleObjects())
            .filter((obj) => isHoverableObject(obj) && obj.isPointInside(worldPoint))
            .reverse(); // Reverse to get top-most objects first
    };

    protected sortVisualObjectsByZIndex = (objectsToSort: Set<VisualObject>): VisualObject[] => {
        return Array.from(objectsToSort).sort((a, b) => {
            // First compare by z-index
            if (a.zIndex !== b.zIndex) {
                return a.zIndex - b.zIndex;
            }
            // If z-index is the same, use insertion order
            return (this.visualObjects.get(a) ?? 0) - (this.visualObjects.get(b) ?? 0);
        });
    };

    // Visual object management methods
    addObject = (obj: VisualObject) => {
        this.visualObjects.set(obj, this.nextInsertionOrder++);
        obj.onPropertyChanged.subscribe(this.handleVisualObjectChange);
        this.onObjectAdded.notify(obj);
        this.draw();
    };

    hasObject = (obj: VisualObject) => {
        return this.visualObjects.has(obj);
    };

    removeObject = (obj: VisualObject) => {
        this.visualObjects.delete(obj);
        obj.onPropertyChanged.unsubscribe(this.handleVisualObjectChange);
        this.onObjectRemoved.notify(obj);
        this.draw();
    };

    clear = () => {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    };

    draw = throttle(() => {
        this.clear();

        // Save the context state
        this.ctx.save();

        // Apply viewport transformation (implemented by subclass)
        this.applyViewportTransformation(this.ctx);

        const visibleObjects = this.visibleVisualObjectsManager.getVisibleObjects();

        // Draw sorted objects that are visible
        const sortedObjects = this.sortVisualObjectsByZIndex(visibleObjects);
        for (const obj of sortedObjects) {
            obj.draw(this.ctx);
        }

        // Restore the context state
        this.ctx.restore();
    }, 1000 / 60);

    protected destroy = () => {
        // Clean up event listeners
        this.canvas.removeEventListener('mousemove', this.handleMouseMove);
        this.canvas.removeEventListener('mousedown', this.handleMouseDown);
        this.canvas.removeEventListener('mouseup', this.handleMouseUp);
        this.canvas.removeEventListener('mouseleave', this.handleMouseUp);
        this.canvas.removeEventListener('click', this.handleMouseClick);
        this.canvas.removeEventListener('dblclick', this.handleMouseDbClick);
        this.canvas.removeEventListener('contextmenu', this.handleContextMenu);

        // Clean up object subscriptions
        for (const obj of this.visualObjects) {
            obj[0].onPropertyChanged.unsubscribe(this.handleVisualObjectChange);
        }

        // Clear objects
        this.visualObjects.clear();
        this.hoveredObjects.clear();
        this.draggedObject = null;

        this.visibleVisualObjectsManager.dispose();
    };

    /** Public wrapper for protected destroy to allow external cleanup */
    public dispose() {
        this.destroy();
    }

    getHeight(): number | undefined {
        return this.canvas.height;
    }

    getWidth(): number | undefined {
        return this.canvas.width;
    }
}

// Type guards
const isDraggableObject = (obj: any): obj is DraggableVisualObject => {
    return 'isDragging' in obj && 'isDraggable' in obj;
};

const isHoverableObject = (obj: any): obj is HoverableVisualObject => {
    return 'handleHover' in obj && 'isHovered' in obj;
};

const isClickableObject = (obj: VisualObject): obj is ClickableVisualObject => {
    return 'handleClick' in obj && 'isClickable' in obj;
};