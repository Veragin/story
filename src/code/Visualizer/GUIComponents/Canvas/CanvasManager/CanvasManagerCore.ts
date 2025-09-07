import { throttle } from 'code/utils/throttle';
import { VisualObject } from '../Node/VisualObject';
import { isPointInside } from '../Node/utils';
import { assertNotNullish } from 'code/utils/typeguards';
import { ConditionalObserver, Observer } from 'code/utils/Observer';
import { CanvasWorld, TPoint, TSize } from './CanvasWorld';
import { IVisibilityProvider } from './VisibleVisualObjectsManager';
import { ISortedVisibleVisualObjectsManager as IZIndexSortedVisibleVisualObjectsManager, ZIndexSortedVisibleVisualObjectsManager } from './ZIndexSortedVisibleVisualObjectsManager';
import { GuiEventDispatcher } from './EventDispatcher';


/**
 * Interface for the canvas manager core that plugins can use to interact with the core functionality.
 */
export interface ICanvasManagerCore {
    readonly canvasWorld: CanvasWorld;
    readonly eventDispatcher: GuiEventDispatcher;
    readonly visibleVisualObjectsManager: IZIndexSortedVisibleVisualObjectsManager;
    get canvasSize(): TSize;
    get allObjects(): Iterable<VisualObject>;
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
    readonly eventDispatcher: GuiEventDispatcher;

    // Visual objects with insertion order
    protected visualObjects: Map<VisualObject, number> = new Map();
    protected nextInsertionOrder: number = 0;

    readonly onObjectAdded = new Observer<VisualObject>();
    readonly onObjectRemoved = new Observer<VisualObject>();
    readonly onObjectPropertyChanged = new Observer<{ object: VisualObject, property: string }>();

    readonly onCanvasResize = new ConditionalObserver<TSize>(
        (lastSize, newSize) => {
            if (!lastSize || !newSize) return false;
            return lastSize.width !== newSize.width || lastSize.height !== newSize.height;
        }
    );

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        const context = canvas.getContext('2d');
        assertNotNullish(context);
        this.ctx = context;

        const dpr = window.devicePixelRatio || 1;
        this.ctx.scale(dpr, dpr);

        this.canvasWorld = new CanvasWorld();
        this.visibleVisualObjectsManager = new ZIndexSortedVisibleVisualObjectsManager(this.canvasWorld, this);
        this.visibleVisualObjectsManager.onVisibleObjectsChanged.subscribe(() => this.draw());

        this.canvasWorld.onViewPositionChange.subscribe(() => this.draw());
        this.canvasWorld.onPixelSizeChange.subscribe(() => this.draw());

        this.eventDispatcher = new GuiEventDispatcher(this);

        // Set up event listeners
        this.canvas.addEventListener('mousemove', this.handleMouseMove);
        this.canvas.addEventListener('mousedown', this.handleMouseDown);
        this.canvas.addEventListener('mouseup', this.handleMouseUp);
        this.canvas.addEventListener('mouseleave', this.handleMouseLeave);
        this.canvas.addEventListener('click', this.handleClick);
        this.canvas.addEventListener('dblclick', this.handleDblClick);
        this.canvas.addEventListener('contextmenu', this.handleContextMenu);
        this.canvas.addEventListener('wheel', this.handleWheel);

        document.addEventListener('keydown', this.handleKeyDown);
        document.addEventListener('keyup', this.handleKeyUp);

        // Note: Canvas resize handling is done in WorldEvents via window.resize
        // as canvas elements don't have a standard 'resize' event
    }
    getCurrentCanvasSize(): TSize {
        throw new Error('Method not implemented.');
    }


    get allObjects(): Iterable<VisualObject> {
        return this.visualObjects.keys();
    }

    getAllObjects(): Iterable<VisualObject> {
        return this.allObjects;
    }

    get canvasSize(): TSize {
        return { width: this.canvas.clientWidth, height: this.canvas.clientHeight };
    }

    getCanvasSize(): TSize {
        return this.canvasSize;
    }

    /**
     * Get the mouse position relative to the visible left top corner of the canvas
     */
    protected getMousePoint(event: MouseEvent | WheelEvent): TPoint {
        const rect = this.canvas.getBoundingClientRect();

        // Calculate position considering potential CSS scaling
        const scaleX = this.canvas.clientWidth / rect.width;
        const scaleY = this.canvas.clientHeight / rect.height;

        return {
            x: (event.clientX - rect.left) * scaleX,
            y: (event.clientY - rect.top) * scaleY,
        };
    }

    protected handleMouseDown = (event: MouseEvent) => {
        const screenPoint = this.getMousePoint(event);
        const worldPoint = this.canvasWorld.screenToWorld(screenPoint);

        this.eventDispatcher.dispatchMouseDown(event, screenPoint, worldPoint);
    };

    protected handleMouseMove = (event: MouseEvent) => {
        const screenPoint = this.getMousePoint(event);
        this.eventDispatcher.dispatchMouseMove(event, screenPoint);
    };

    protected handleMouseUp = (event: MouseEvent) => {
        const screenPoint = this.getMousePoint(event);
        const worldPoint = this.canvasWorld.screenToWorld(screenPoint);

        this.eventDispatcher.dispatchMouseUp(event, screenPoint, worldPoint);
    };

    protected handleMouseLeave = () => {
        this.eventDispatcher.dispatchMouseLeave();
    };

    protected handleClick = (event: MouseEvent) => {
        const screenPoint = this.getMousePoint(event);
        const worldPoint = this.canvasWorld.screenToWorld(screenPoint);

        this.eventDispatcher.dispatchClick(event, screenPoint, worldPoint);
    };

    protected handleDblClick = (event: MouseEvent) => {
        const screenPoint = this.getMousePoint(event);
        const worldPoint = this.canvasWorld.screenToWorld(screenPoint);

        this.eventDispatcher.dispatchDblClick(event, screenPoint, worldPoint);
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
            .filter((obj: VisualObject) => isPointInside(worldPoint, obj.getPosition(), obj.getSize()))
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

        // scale first, then translate
        ctx.scale(zoomX, zoomY);
        ctx.translate(-viewPos.x, -viewPos.y);
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
        this.canvas.removeEventListener('mouseleave', this.handleMouseLeave);
        this.canvas.removeEventListener('click', this.handleClick);
        this.canvas.removeEventListener('dblclick', this.handleDblClick);
        this.canvas.removeEventListener('contextmenu', this.handleContextMenu);
        this.canvas.removeEventListener('wheel', this.handleWheel);

        document.removeEventListener('keydown', this.handleKeyDown);
        document.removeEventListener('keyup', this.handleKeyUp);

        for (const obj of this.visualObjects) {
            obj[0].onPropertyChanged.unsubscribe(this.handleVisualObjectChange);
        }

        this.visualObjects.clear();

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