import { throttle } from 'code/utils/throttle';
import { ClickableVisualObject } from '../Node/ClickableVisualObject';
import { DraggableVisualObject } from '../Node/DraggableVisualObject';
import { HoverableVisualObject } from '../Node/HoverableVisualObject';
import { VisualObject } from '../Node/VisualObject';
import { assertNotNullish } from 'code/utils/typeguards';
import { ConditionalObserver, Observer } from 'code/utils/Observer';
import { CanvasWorld } from './CanvasWorld';
import { IVisibilityProvider } from './VisibleVisualObjectsManager';
import { ISortedVisibleVisualObjectsManager as IZIndexSortedVisibleVisualObjectsManager, ZIndexSortedVisibleVisualObjectsManager } from './ZIndexSortedVisibleVisualObjectsManager';
import { EventDispatcher } from './EventDispatcher';
import { MouseButton } from './InputConstants';

// Assuming these types are defined elsewhere
type TPoint = { x: number; y: number };
type TSize = { width: number; height: number };

/**
 * Interface for the canvas manager core that plugins can use to interact with the core functionality.
 */
export interface ICanvasManagerCore {
    readonly canvas: HTMLCanvasElement;
    readonly canvasWorld: CanvasWorld;
    readonly eventDispatcher: EventDispatcher;
    readonly visibleVisualObjectsManager: IZIndexSortedVisibleVisualObjectsManager;
    updateCursor(cursor: string): void;
    requestRedraw(): void;
}

/**
 * Core canvas manager class handling base functionality without specific behaviors like panning or zooming.
 * Plugins can extend functionality by registering with the event dispatcher.
 */
export class CanvasManagerCore implements ICanvasManagerCore, IVisibilityProvider {
    readonly canvas: HTMLCanvasElement;
    protected ctx: CanvasRenderingContext2D;
    readonly canvasWorld: CanvasWorld;
    readonly visibleVisualObjectsManager: IZIndexSortedVisibleVisualObjectsManager;
    readonly eventDispatcher: EventDispatcher;

    // Visual objects with insertion order
    protected visualObjects: Map<VisualObject, number> = new Map();
    protected hoveredObjects: Set<HoverableVisualObject> = new Set();
    protected nextInsertionOrder: number = 0;
    protected draggedObject: DraggableVisualObject | null = null;

    readonly onObjectAdded = new Observer<VisualObject>();
    readonly onObjectRemoved = new Observer<VisualObject>();
    readonly onObjectPropertyChanged = new Observer<{ object: VisualObject, property: string }>();

    readonly onCanvasResize = new ConditionalObserver<TSize>(
        (lastSize, newSize) => {
            if (!lastSize || !newSize) return false;
            return lastSize.width !== newSize.width || lastSize.height !== newSize.height;
        }
    );

    // Use logical (CSS) size for calculations
    get canvasSize(): TSize {
        return { width: this.canvas.clientWidth, height: this.canvas.clientHeight };
    }

    dragMode = true;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        const context = canvas.getContext('2d');
        assertNotNullish(context);
        this.ctx = context;

        // Use dynamic devicePixelRatio instead of constant RESOLUTION_FACTOR
        const dpr = window.devicePixelRatio || 1;
        this.ctx.scale(dpr, dpr);

        this.canvasWorld = new CanvasWorld();
        this.visibleVisualObjectsManager = new ZIndexSortedVisibleVisualObjectsManager(this.canvasWorld, this);
        this.visibleVisualObjectsManager.onVisibleObjectsChanged.subscribe(() => this.draw());

        this.canvasWorld.onViewPositionChange.subscribe(() => this.draw());
        this.canvasWorld.onPixelSizeChange.subscribe(() => this.draw());

        this.eventDispatcher = new EventDispatcher(this);

        // Set up event listeners
        this.canvas.addEventListener('mousemove', this.handleMouseMove);
        this.canvas.addEventListener('mousedown', this.handleMouseDown);
        this.canvas.addEventListener('mouseup', this.handleMouseUp);
        this.canvas.addEventListener('mouseleave', this.handleMouseUp);
        this.canvas.addEventListener('click', this.handleMouseClick);
        this.canvas.addEventListener('dblclick', this.handleMouseDbClick);
        this.canvas.addEventListener('contextmenu', this.handleContextMenu);
        this.canvas.addEventListener('wheel', this.handleWheel);

        document.addEventListener('keydown', this.handleKeyDown);
        document.addEventListener('keyup', this.handleKeyUp);

        // Note: Canvas resize handling is done in WorldEvents via window.resize
        // as canvas elements don't have a standard 'resize' event
    }

    getAllObjects(): Iterable<VisualObject> {
        return this.visualObjects.keys();
    }

    getCanvasSize(): TSize {
        return this.canvasSize;
    }

    protected getMousePoint(event: MouseEvent | WheelEvent): TPoint {
        // Use offsetX and offsetY for more accurate position relative to canvas
        return {
            x: event.offsetX,
            y: event.offsetY,
        };
    }

    protected handleMouseDown = (event: MouseEvent) => {
        const screenPoint = this.getMousePoint(event);
        const worldPoint = this.canvasWorld.screenToWorld(screenPoint);

        if (this.eventDispatcher.dispatchMouseDown(event, screenPoint, worldPoint)) {
            return;
        }

        if (!this.dragMode) return;

        const objectsAtPoint = this.getTopObjectsAtVisiblePoint(worldPoint);

        if (event.button === MouseButton.LEFT) {
            const draggableObject = objectsAtPoint.find((obj) =>
                isDraggableObject(obj) && obj.isDraggable()
            ) as DraggableVisualObject | undefined;

            if (draggableObject) {
                this.draggedObject = draggableObject;
                draggableObject.startDrag(worldPoint);

                const currentZIndex = draggableObject.zIndex;
                const highestZIndex = Math.max(
                    ...Array.from(this.visualObjects.keys()).map((obj) => obj.zIndex)
                );
                if (currentZIndex <= highestZIndex) {
                    draggableObject.setZIndex(highestZIndex + 1);
                }
            }
        }

        if (event.button === MouseButton.RIGHT) {
            for (const obj of objectsAtPoint) {
                if (isClickableObject(obj)) {
                    obj.handleRightDown(worldPoint);
                }
            }
        }
    };

    protected handleMouseMove = (event: MouseEvent) => {
        const screenPoint = this.getMousePoint(event);

        if (this.eventDispatcher.dispatchMouseMove(event, screenPoint)) {
            return;
        }

        const worldPoint = this.canvasWorld.screenToWorld(screenPoint);

        if (this.draggedObject && this.dragMode) {
            this.draggedObject.drag(worldPoint);
            return;
        }

        const hoveredObjectsThisFrame = new Set<HoverableVisualObject>();
        const objectsAtPoint = this.getTopObjectsAtVisiblePoint(worldPoint);

        for (const obj of this.visualObjects.keys()) {
            if (isHoverableObject(obj)) {
                const isTopMost = objectsAtPoint[0] === obj;
                if (isTopMost && obj.isPointInside(worldPoint)) {
                    obj.handleHover(worldPoint);
                    if (obj.isHovered()) {
                        hoveredObjectsThisFrame.add(obj);
                    }
                } else {
                    if (obj.isHovered()) {
                        obj.handleHover({ x: -1, y: -1 });
                    }
                }
            }
        }

        this.hoveredObjects = hoveredObjectsThisFrame;
    };

    protected handleMouseUp = (event: MouseEvent) => {
        const screenPoint = this.getMousePoint(event);
        const worldPoint = this.canvasWorld.screenToWorld(screenPoint);

        this.eventDispatcher.dispatchMouseUp(event, screenPoint, worldPoint);

        if (this.draggedObject) {
            this.draggedObject.endDrag(worldPoint);
            this.draggedObject = null;
        }
    };

    protected handleMouseClick = (event: MouseEvent) => {
        const screenPoint = this.getMousePoint(event);
        const worldPoint = this.canvasWorld.screenToWorld(screenPoint);

        if (this.draggedObject) {
            return;
        }

        const objectsAtPoint = this.getTopObjectsAtVisiblePoint(worldPoint);
        for (const obj of objectsAtPoint) {
            if (isClickableObject(obj)) {
                const handled = obj.handleClick(worldPoint);
                if (handled) {
                    break;
                }
            }
        }
    };

    protected handleMouseDbClick = (event: MouseEvent) => {
        const screenPoint = this.getMousePoint(event);
        const worldPoint = this.canvasWorld.screenToWorld(screenPoint);

        if (this.draggedObject) {
            return;
        }

        const objectsAtPoint = this.getTopObjectsAtVisiblePoint(worldPoint);
        for (const obj of objectsAtPoint) {
            if (isClickableObject(obj)) {
                const handled = obj.handleDbClick(worldPoint);
                if (handled) {
                    break;
                }
            }
        }
    };

    protected handleContextMenu = (event: MouseEvent) => {
        event.preventDefault();
        return false;
    };

    protected handleWheel = (event: WheelEvent) => {
        const screenPoint = this.getMousePoint(event);
        const worldPoint = this.canvasWorld.screenToWorld(screenPoint);

        this.eventDispatcher.dispatchWheel(event, screenPoint, worldPoint);
    };

    protected handleKeyDown = (event: KeyboardEvent) => {
        this.eventDispatcher.dispatchKeyDown(event);
    };

    protected handleKeyUp = (event: KeyboardEvent) => {
        this.eventDispatcher.dispatchKeyUp(event);
    };

    private handleVisualObjectChange = (args: { property: string; VisualObject: VisualObject }) => {
        this.onObjectPropertyChanged.notify({
            object: args.VisualObject,
            property: args.property
        });
        this.draw();
    };

    protected getTopObjectsAtVisiblePoint(worldPoint: TPoint): VisualObject[] {
        return this.visibleVisualObjectsManager.getSortedVisibleObjects()
            .filter((obj: VisualObject) =>
                isHoverableObject(obj) && obj.isPointInside(worldPoint))
            .reverse();
    }

    addObject(obj: VisualObject): void {
        this.visualObjects.set(obj, this.nextInsertionOrder++);
        obj.onPropertyChanged.subscribe(this.handleVisualObjectChange);
        this.onObjectAdded.notify(obj);
        this.draw();
    }

    hasObject(obj: VisualObject): boolean {
        return this.visualObjects.has(obj);
    }

    removeObject(obj: VisualObject): void {
        this.visualObjects.delete(obj);
        obj.onPropertyChanged.unsubscribe(this.handleVisualObjectChange);
        this.onObjectRemoved.notify(obj);
        this.draw();
    }

    clear(): void {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    draw = throttle(() => {
        this.clear();

        this.ctx.save();

        this.applyViewportTransformation(this.ctx);

        const sortedObjects = this.visibleVisualObjectsManager.getSortedVisibleObjects();
        for (const obj of sortedObjects) {
            obj.draw(this.ctx);
        }

        this.ctx.restore();
    }, 1000 / 60);

    protected applyViewportTransformation(ctx: CanvasRenderingContext2D): void {
        const pixelSize = this.canvasWorld.pixelSizeInWorldUnits;
        const zoomX = 1 / pixelSize.width;
        const zoomY = 1 / pixelSize.height;
        const viewPos = this.canvasWorld.viewPosition;

        ctx.scale(zoomX, zoomY);
        ctx.translate(-viewPos.x * zoomX, -viewPos.y * zoomY);
    }

    updateCursor(cursor: string): void {
        this.canvas.style.cursor = cursor;
    }

    requestRedraw(): void {
        this.draw();
    }

    protected destroy(): void {
        this.canvas.removeEventListener('mousemove', this.handleMouseMove);
        this.canvas.removeEventListener('mousedown', this.handleMouseDown);
        this.canvas.removeEventListener('mouseup', this.handleMouseUp);
        this.canvas.removeEventListener('mouseleave', this.handleMouseUp);
        this.canvas.removeEventListener('click', this.handleMouseClick);
        this.canvas.removeEventListener('dblclick', this.handleMouseDbClick);
        this.canvas.removeEventListener('contextmenu', this.handleContextMenu);
        this.canvas.removeEventListener('wheel', this.handleWheel);

        document.removeEventListener('keydown', this.handleKeyDown);
        document.removeEventListener('keyup', this.handleKeyUp);

        for (const obj of this.visualObjects) {
            obj[0].onPropertyChanged.unsubscribe(this.handleVisualObjectChange);
        }

        this.visualObjects.clear();
        this.hoveredObjects.clear();
        this.draggedObject = null;

        this.visibleVisualObjectsManager.dispose();
    }

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

// Type guards (same as before)
const isDraggableObject = (obj: any): obj is DraggableVisualObject => {
    return 'isDragging' in obj && 'isDraggable' in obj;
};

const isHoverableObject = (obj: any): obj is HoverableVisualObject => {
    return 'handleHover' in obj && 'isHovered' in obj;
};

const isClickableObject = (obj: VisualObject): obj is ClickableVisualObject => {
    return 'handleClick' in obj && 'isClickable' in obj;
};