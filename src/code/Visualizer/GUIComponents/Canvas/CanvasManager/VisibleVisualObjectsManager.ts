import { throttle } from 'code/utils/throttle';
import { VisualObject } from '../Node/VisualObject';
import { Observer } from 'code/utils/Observer';
import { CanvasWorld } from './CanvasWorld';

/**
 * Interface for managing visible visual objects,
 * the objects that are currently visible in the viewport
 */
export interface IVisibleVisualObjectsManager {
    getVisibleObjects(): Set<VisualObject>;
    onVisibleObjectsChanged: Observer<Set<VisualObject>>;
    setCanvasSize(size: TSize): void;
    dispose(): void;
}

export interface IVisibilityProvider {
    getAllObjects(): Iterable<VisualObject>;
    getCanvasSize(): TSize;
    onObjectAdded: Observer<VisualObject>;
    onObjectRemoved: Observer<VisualObject>;
    onObjectPropertyChanged: Observer<{ object: VisualObject, property: string }>;
}

export class VisibleVisualObjectsManager implements IVisibleVisualObjectsManager {
    protected visibleVisualObjects: Set<VisualObject> = new Set();
    protected canvasWorld: CanvasWorld;
    protected provider: IVisibilityProvider;

    public readonly onVisibleObjectsChanged = new Observer<Set<VisualObject>>();

    constructor(canvasWorld: CanvasWorld, provider: IVisibilityProvider) {
        this.canvasWorld = canvasWorld;
        this.provider = provider;

        // Remove throttle: call directly for immediate updates
        this.canvasWorld.onViewPositionChange.subscribe(() => this.checkAllVisualObjectsVisibility());
        this.canvasWorld.onPixelSizeChange.subscribe(() => this.checkAllVisualObjectsVisibility());

        this.provider.onObjectAdded.subscribe((obj) => this.handleObjectAdded(obj));
        this.provider.onObjectRemoved.subscribe((obj) => this.handleObjectRemoved(obj));
        this.provider.onObjectPropertyChanged.subscribe(({ object, property }) =>
            this.handleVisualObjectPropertyChanged(object, property));

        // Initial visibility check
        this.checkAllVisualObjectsVisibility();
    }

    setCanvasSize(size: TSize) {
        this.provider.getCanvasSize = () => size;
        this.checkAllVisualObjectsVisibility();  // Direct call, no throttle
    }

    getVisibleObjects(): Set<VisualObject> {
        return this.visibleVisualObjects;
    }

    protected handleObjectAdded(obj: VisualObject) {
        this.checkVisualObjectVisibility(obj);
    }

    protected handleObjectRemoved(obj: VisualObject) {
        if (this.visibleVisualObjects.has(obj)) {
            this.visibleVisualObjects.delete(obj);
            this.onVisibleObjectsChanged.notify(this.visibleVisualObjects);
        }
    }

    protected handleVisualObjectPropertyChanged(obj: VisualObject, property: string) {
        if (property === 'position' || property === 'size') {  // Fixed: 'size' lowercase
            this.checkVisualObjectVisibility(obj);
        }
    }

    // Now this is a regular method that can be overridden
    protected checkAllVisualObjectsVisibility(): void {
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

    protected checkVisualObjectVisibility(obj: VisualObject) {
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
        obj: VisualObject,
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

    dispose() {
    }
}