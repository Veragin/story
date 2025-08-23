import { throttle } from 'code/utils/throttle';
import { VisualObject } from '../Node/VisualObject';
import { Observer } from 'code/utils/Observer';
import { CanvasWorld } from './CanvasWorld';

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
    private _visibleVisualObjects: Set<VisualObject> = new Set();
    private _canvasWorld: CanvasWorld;
    private _provider: IVisibilityProvider;

    public readonly onVisibleObjectsChanged = new Observer<Set<VisualObject>>();

    constructor(canvasWorld: CanvasWorld, provider: IVisibilityProvider) {
        this._canvasWorld = canvasWorld;
        this._provider = provider;

        // Subscribe to world changes
        this._canvasWorld.onViewPositionChange.subscribe(() => this.checkAllVisualObjectsVisibility());
        this._canvasWorld.onPixelSizeChange.subscribe(() => this.checkAllVisualObjectsVisibility());

        // Subscribe to object changes
        this._provider.onObjectAdded.subscribe((obj) => this.handleObjectAdded(obj));
        this._provider.onObjectRemoved.subscribe((obj) => this.handleObjectRemoved(obj));
        this._provider.onObjectPropertyChanged.subscribe(({ object, property }) =>
            this.handleVisualObjectPropertyChanged(object, property));

        // Initial visibility check
        this.checkAllVisualObjectsVisibility();
    }

    setCanvasSize(size: TSize) {
        this._provider.getCanvasSize = () => size;
        this.checkAllVisualObjectsVisibility();
    }

    getVisibleObjects(): Set<VisualObject> {
        return this._visibleVisualObjects;
    }

    private handleObjectAdded(obj: VisualObject) {
        this.checkVisualObjectVisibility(obj);
    }

    private handleObjectRemoved(obj: VisualObject) {
        if (this._visibleVisualObjects.has(obj)) {
            this._visibleVisualObjects.delete(obj);
            this.onVisibleObjectsChanged.notify(this._visibleVisualObjects);
        }
    }

    private handleVisualObjectPropertyChanged(obj: VisualObject, property: string) {
        if (property === 'position' || property === 'Size') {
            this.checkVisualObjectVisibility(obj);
        }
    }

    private checkAllVisualObjectsVisibility = throttle(() => {
        const visibleBounds = this._canvasWorld.getVisibleWorldBounds(this._provider.getCanvasSize());
        const previousVisibleObjects = new Set(this._visibleVisualObjects);
        this._visibleVisualObjects.clear();

        let hasChanges = false;

        for (const obj of this._provider.getAllObjects()) {
            const isVisible = this.isObjVisible(obj, visibleBounds);
            if (isVisible) {
                this._visibleVisualObjects.add(obj);

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
            this.onVisibleObjectsChanged.notify(this._visibleVisualObjects);
        }
    }, 1000 / 30);

    private checkVisualObjectVisibility(obj: VisualObject) {
        const visibleBounds = this._canvasWorld.getVisibleWorldBounds(this._provider.getCanvasSize());
        const isVisible = this.isObjVisible(obj, visibleBounds);
        const wasVisible = this._visibleVisualObjects.has(obj);

        if (isVisible && !wasVisible) {
            this._visibleVisualObjects.add(obj);
            this.onVisibleObjectsChanged.notify(this._visibleVisualObjects);
        } else if (!isVisible && wasVisible) {
            this._visibleVisualObjects.delete(obj);
            this.onVisibleObjectsChanged.notify(this._visibleVisualObjects);
        }
    }

    private isObjVisible(
        obj: VisualObject,
        visibleBounds: { min: TPoint; max: TPoint }
    ): boolean {
        const pos = obj.getPosition();
        const size = obj.getSize();

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