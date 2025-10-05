import { throttle } from 'code/utils/throttle';
import { MementoAwareVisualObject, TMementoAwareVisualObjectPropertyChangeArgs } from '../Node/VisualObject';
import { isPointInside } from '../Node/utils';
import { assertNotNullish } from 'code/utils/typeguards';
import { CanvasWorld, TPoint, TSize } from './CanvasWorld';
import { IVisibilityProvider } from './VisibleVisualObjectsManager';
import { ISortedVisibleVisualObjectsManager as IZIndexSortedVisibleVisualObjectsManager, ZIndexSortedVisibleVisualObjectsManager } from './ZIndexSortedVisibleVisualObjectsManager';
import { GuiEventDispatcher } from './EventDispatcher';
import { CanvasEventManager } from './CanvasEventManager';
import { WithMemento, MementoRecord, MementoRegistry } from '../../MementoSystem/Memento/mementoTypes';
import { MementoAwareObserver } from '../../MementoSystem/MementoAwareObserver';
import { BaseMementoAwareListener } from '../../MementoSystem/MementoAwareListeners';

/**
 * Interface for the canvas manager core that plugins can use to interact with the core functionality.
 */
export interface ICanvasManagerCore {
    readonly canvasWorld: CanvasWorld;
    readonly eventDispatcher: GuiEventDispatcher;
    readonly visibleVisualObjectsManager: IZIndexSortedVisibleVisualObjectsManager;
    get canvasSize(): TSize;
    get allObjects(): Iterable<MementoAwareVisualObject>;
    updateCursor(cursor: string): void;
    requestRedraw(): void;
    destroy(): void;
}

/**
 * Core canvas manager class handling base functionality without specific behaviors like panning or zooming.
 * Plugins can extend functionality by registering with the event dispatcher.
 */
export class CanvasManagerCore implements ICanvasManagerCore, IVisibilityProvider, WithMemento {
    /**
     * Listener that calls draw on the CanvasManagerCore.
     * The target reference is automatically restored by the memento system.
     */
    private DrawListener = class extends BaseMementoAwareListener<any> {
        constructor(id: string, private outer: CanvasManagerCore) {
            super(id);
        }

        onNotify = (_data: any): void => {
            this.outer.draw();
        }
    };

    /**
     * Listener that handles visual object property changes.
     * Contains the logic directly to avoid unnecessary wrapper methods.
     */
    private VisualObjectChangeListener = class extends BaseMementoAwareListener<TMementoAwareVisualObjectPropertyChangeArgs> {
        constructor(id: string, private outer: CanvasManagerCore) {
            super(id);
        }

        onNotify = (args: TMementoAwareVisualObjectPropertyChangeArgs): void => {
            this.outer.onObjectPropertyChanged.notify({
                object: args.VisualObject,
                property: args.property
            });
            this.outer.draw();
        }
    };

    private id: string;
    readonly canvas: HTMLCanvasElement;
    protected ctx: CanvasRenderingContext2D;
    readonly canvasWorld: CanvasWorld;
    readonly visibleVisualObjectsManager: IZIndexSortedVisibleVisualObjectsManager;
    readonly eventDispatcher: GuiEventDispatcher;
    private readonly eventHandler: CanvasEventManager;

    // Visual objects with insertion order
    protected visualObjects: Map<MementoAwareVisualObject, number> = new Map();
    protected nextInsertionOrder: number = 0;
    readonly onObjectAdded: MementoAwareObserver<MementoAwareVisualObject>;
    readonly onObjectRemoved: MementoAwareObserver<MementoAwareVisualObject>;
    readonly onObjectPropertyChanged: MementoAwareObserver<{ object: MementoAwareVisualObject, property: string }>;
    readonly onCanvasResize: MementoAwareObserver<TSize>;

    private readonly handleVisualObjectChangeListener: BaseMementoAwareListener<TMementoAwareVisualObjectPropertyChangeArgs>;

    constructor(canvas: HTMLCanvasElement, id: string = 'canvas-manager-core') {
        this.id = id;
        this.canvas = canvas;
        const context = canvas.getContext('2d');
        assertNotNullish(context);
        this.ctx = context;
        const dpr = window.devicePixelRatio || 1;
        this.ctx.scale(dpr, dpr);
        this.canvasWorld = new CanvasWorld(`${id}_world`);

        // Initialize MementoAware observers BEFORE creating the visible objects manager
        this.onObjectAdded = new MementoAwareObserver<MementoAwareVisualObject>(`${id}_objectAdded`);
        this.onObjectRemoved = new MementoAwareObserver<MementoAwareVisualObject>(`${id}_objectRemoved`);
        this.onObjectPropertyChanged = new MementoAwareObserver<{ object: MementoAwareVisualObject, property: string }>(`${id}_objectPropertyChanged`);
        this.onCanvasResize = new MementoAwareObserver<TSize>(`${id}_canvasResize`);

        this.visibleVisualObjectsManager = new ZIndexSortedVisibleVisualObjectsManager(this.canvasWorld, this, `${id}_visible-manager`);

        // Create specific MementoAware listeners
        const drawListener = new this.DrawListener(`${id}_draw-listener`, this);
        this.handleVisualObjectChangeListener = new this.VisualObjectChangeListener(`${id}_visualObjectChangeListener`, this);

        this.visibleVisualObjectsManager.onVisibleObjectsChanged.subscribe(drawListener);
        this.canvasWorld.onViewPositionChange.subscribe(drawListener);
        this.canvasWorld.onPixelSizeChange.subscribe(drawListener);
        this.eventDispatcher = new GuiEventDispatcher(this);
        this.eventHandler = new CanvasEventManager(this.canvas, this.canvasWorld, this.eventDispatcher);
    }

    getId(): string {
        return this.id;
    }

    getObjectTypeName(): string {
        return this.constructor.name;
    }

    getCurrentCanvasSize(): TSize {
        throw new Error('Method not implemented.');
    }

    get allObjects(): Iterable<MementoAwareVisualObject> {
        return this.visualObjects.keys();
    }

    getAllObjects(): Iterable<MementoAwareVisualObject> {
        return this.allObjects;
    }

    get canvasSize(): TSize {
        return { width: this.canvas.clientWidth, height: this.canvas.clientHeight };
    }

    getCanvasSize(): TSize {
        return this.canvasSize;
    }

    protected getTopObjectsAtVisiblePoint(worldPoint: TPoint): MementoAwareVisualObject[] {
        return this.visibleVisualObjectsManager.getSortedVisibleObjects()
            .filter((obj: MementoAwareVisualObject) => isPointInside(worldPoint, obj.getPosition(), obj.getSize()))
            .reverse();
    }

    addObject(obj: MementoAwareVisualObject): void {
        this.visualObjects.set(obj, this.nextInsertionOrder++);
        obj.onPropertyChanged.subscribe(this.handleVisualObjectChangeListener);
        this.onObjectAdded.notify(obj);
        this.draw();
    }

    hasObject(obj: MementoAwareVisualObject): boolean {
        return this.visualObjects.has(obj);
    }

    removeObject(obj: MementoAwareVisualObject): void {
        this.visualObjects.delete(obj);
        obj.onPropertyChanged.unsubscribe(this.handleVisualObjectChangeListener);
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

    destroy(): void {
        this.eventHandler.destroy();
        for (const [obj] of this.visualObjects) {
            obj.onPropertyChanged.unsubscribe(this.handleVisualObjectChangeListener);
        }
        this.visualObjects.clear();
        this.visibleVisualObjectsManager.destroy();
    }

    getHeight(): number | undefined {
        return this.canvas.height;
    }

    getWidth(): number | undefined {
        return this.canvas.width;
    }
}