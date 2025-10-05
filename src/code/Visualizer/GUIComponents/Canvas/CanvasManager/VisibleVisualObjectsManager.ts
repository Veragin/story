import { MementoAwareVisualObject } from '../Node/VisualObject';
import { CanvasWorld } from './CanvasWorld';
import { MementoAwareObserver } from '../../MementoSystem/MementoAwareObserver';
import { WithMemento, MementoRecord, MementoRegistry } from '../../MementoSystem/Memento/mementoTypes';
import { BaseMementoAwareListener } from '../../MementoSystem/MementoAwareListeners';

/**
 * Interface for managing visible visual objects,
 * the objects that are currently visible in the viewport
 */
export interface IVisibleVisualObjectsManager {
    getVisibleObjects(): Set<MementoAwareVisualObject>;
    onVisibleObjectsChanged: MementoAwareObserver<Set<MementoAwareVisualObject>>;
    setCanvasSize(size: TSize): void;
    destroy(): void;
}

export interface IVisibilityProvider {
    getAllObjects(): Iterable<MementoAwareVisualObject>;
    getCanvasSize(): TSize;
    onObjectAdded: MementoAwareObserver<MementoAwareVisualObject>;
    onObjectRemoved: MementoAwareObserver<MementoAwareVisualObject>;
    onObjectPropertyChanged: MementoAwareObserver<{ object: MementoAwareVisualObject, property: string }>;
}

export class VisibleVisualObjectsManager implements IVisibleVisualObjectsManager, WithMemento {

    private CheckVisibilityListener = class extends BaseMementoAwareListener<any> {
        constructor(id: string, private outer: VisibleVisualObjectsManager) {
            super(id);
        }

        onNotify = (_data: any): void => {
            this.outer.checkAllVisualObjectsVisibility();
        }
    };

    private ObjectAddedListener = class extends BaseMementoAwareListener<MementoAwareVisualObject> {
        constructor(id: string, private outer: VisibleVisualObjectsManager) {
            super(id);
        }

        onNotify = (obj: MementoAwareVisualObject): void => {
            this.outer.checkVisualObjectVisibility(obj);
        }
    };

    private ObjectRemovedListener = class extends BaseMementoAwareListener<MementoAwareVisualObject> {
        constructor(id: string, private outer: VisibleVisualObjectsManager) {
            super(id);
        }

        onNotify = (obj: MementoAwareVisualObject): void => {
            if (this.outer.visibleVisualObjects.has(obj)) {
                this.outer.visibleVisualObjects.delete(obj);
                this.outer.onVisibleObjectsChanged.notify(this.outer.visibleVisualObjects);
            }
        }
    };

    private ObjectPropertyChangedListener = class extends BaseMementoAwareListener<{ object: MementoAwareVisualObject, property: string }> {
        constructor(id: string, private outer: VisibleVisualObjectsManager) {
            super(id);
        }

        onNotify = (data: { object: MementoAwareVisualObject, property: string }): void => {
            if (data.property === 'position' || data.property === 'size') {
                this.outer.checkVisualObjectVisibility(data.object);
            }
        }
    };

    private id: string;
    protected visibleVisualObjects: Set<MementoAwareVisualObject> = new Set();
    private canvasWorld: CanvasWorld;
    protected provider: IVisibilityProvider;

    public readonly onVisibleObjectsChanged: MementoAwareObserver<Set<MementoAwareVisualObject>>;

    constructor(canvasWorld: CanvasWorld, provider: IVisibilityProvider, id: string = 'visible-objects-manager') {
        this.id = id;
        this.canvasWorld = canvasWorld;
        this.provider = provider;
        this.onVisibleObjectsChanged = new MementoAwareObserver<Set<MementoAwareVisualObject>>(`${id}_visibleObjectsChanged`);

        // Create specific MementoAware listeners
        const checkVisibilityListener = new this.CheckVisibilityListener(`${id}_checkVisibility`, this);
        const objectAddedListener = new this.ObjectAddedListener(`${id}_objectAdded`, this);
        const objectRemovedListener = new this.ObjectRemovedListener(`${id}_objectRemoved`, this);
        const propertyChangedListener = new this.ObjectPropertyChangedListener(`${id}_propertyChanged`, this);

        // Subscribe listeners
        this.canvasWorld.onViewPositionChange.subscribe(checkVisibilityListener);
        this.canvasWorld.onPixelSizeChange.subscribe(checkVisibilityListener);
        this.provider.onObjectAdded.subscribe(objectAddedListener);
        this.provider.onObjectRemoved.subscribe(objectRemovedListener);
        this.provider.onObjectPropertyChanged.subscribe(propertyChangedListener);

        // Initial visibility check
        this.checkAllVisualObjectsVisibility();
    }

    getId(): string {
        return this.id;
    }

    getObjectTypeName(): string {
        return this.constructor.name;
    }

    setCanvasSize(size: TSize) {
        this.provider.getCanvasSize = () => size;
        this.checkAllVisualObjectsVisibility();
    }

    getVisibleObjects(): Set<MementoAwareVisualObject> {
        return this.visibleVisualObjects;
    }

    private checkAllVisualObjectsVisibility(): void {
        const visibleBounds = this.canvasWorld.getVisibleWorldBounds(this.provider.getCanvasSize());
        const previousVisibleObjects = new Set(this.visibleVisualObjects);
        this.visibleVisualObjects.clear();

        let hasChanges = false;

        for (const obj of this.provider.getAllObjects()) {
            const isVisible = this.isObjVisible(obj, visibleBounds);
            if (isVisible) {
                this.visibleVisualObjects.add(obj);

                // Check if this object wasn't visible before
                if (!previousVisibleObjects.has(obj)) {
                    hasChanges = true;
                }
            } else if (previousVisibleObjects.has(obj)) {
                // This object was visible before but isn't now
                hasChanges = true;
            }
        }

        // Only notify if there are changes
        if (hasChanges) {
            this.onVisibleObjectsChanged.notify(this.visibleVisualObjects);
        }
    }

    private checkVisualObjectVisibility(obj: MementoAwareVisualObject) {
        const visibleBounds = this.canvasWorld.getVisibleWorldBounds(this.provider.getCanvasSize());
        const isVisible = this.isObjVisible(obj, visibleBounds);
        const wasVisible = this.visibleVisualObjects.has(obj);

        if (isVisible && !wasVisible) {
            this.visibleVisualObjects.add(obj);
            this.onVisibleObjectsChanged.notify(this.visibleVisualObjects);
        } else if (!isVisible && wasVisible) {
            this.visibleVisualObjects.delete(obj);
            this.onVisibleObjectsChanged.notify(this.visibleVisualObjects);
        }
    }

    protected isObjVisible(
        obj: MementoAwareVisualObject,
        visibleBounds: { min: TPoint; max: TPoint }
    ): boolean {
        const pos = obj.getPosition();
        const size = obj.getSize();

        // Check if object is smaller than a pixel in either dimension
        const pixelSize = this.canvasWorld.pixelSizeInWorldUnits;
        const objWidthInPixels = size.width / pixelSize.width;
        const objHeightInPixels = size.height / pixelSize.height;

        if (objWidthInPixels < 1 || objHeightInPixels < 1) {
            return false;
        }

        // Original visibility check
        return (
            pos.x + size.width >= visibleBounds.min.x &&
            pos.x <= visibleBounds.max.x &&
            pos.y + size.height >= visibleBounds.min.y &&
            pos.y <= visibleBounds.max.y
        );
    }

    destroy() {
    }
}