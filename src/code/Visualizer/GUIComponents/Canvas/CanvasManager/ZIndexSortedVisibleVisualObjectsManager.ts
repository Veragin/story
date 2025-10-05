import { MementoAwareVisualObject } from '../Node/VisualObject';
import { CanvasWorld } from './CanvasWorld';
import { VisibleVisualObjectsManager, IVisibilityProvider, IVisibleVisualObjectsManager } from './VisibleVisualObjectsManager';
import { BaseMementoAwareListener } from '../../MementoSystem/MementoAwareListeners';

/**
 * Interface for managing visible visual objects with z-index sorting
 * Extends the base interface with methods for retrieving pre-sorted objects
 */
export interface ISortedVisibleVisualObjectsManager extends IVisibleVisualObjectsManager {
    /**
     * Get visible objects sorted by z-index and insertion order
     * Objects with higher z-index appear later in the array (drawn on top)
     * Objects with same z-index are sorted by insertion order
     */
    getSortedVisibleObjects(): MementoAwareVisualObject[];
}

export class ZIndexSortedVisibleVisualObjectsManager extends VisibleVisualObjectsManager {
    private InsertionOrderListener = class extends BaseMementoAwareListener<MementoAwareVisualObject> {
        constructor(id: string, private outer: ZIndexSortedVisibleVisualObjectsManager) {
            super(id);
        }

        onNotify = (obj: MementoAwareVisualObject): void => {
            this.outer.trackInsertionOrder(obj);
        }
    };

    private InsertionOrderCleanupListener = class extends BaseMementoAwareListener<MementoAwareVisualObject> {
        constructor(id: string, private outer: ZIndexSortedVisibleVisualObjectsManager) {
            super(id);
        }

        onNotify = (obj: MementoAwareVisualObject): void => {
            this.outer.cleanupInsertionOrder(obj);
        }
    };

    private ZIndexChangeListener = class extends BaseMementoAwareListener<{ object: MementoAwareVisualObject, property: string }> {
        constructor(id: string, private outer: ZIndexSortedVisibleVisualObjectsManager) {
            super(id);
        }

        onNotify = (data: { object: MementoAwareVisualObject, property: string }): void => {
            if (data.property === 'zIndex' && this.outer.getVisibleObjects().has(data.object)) {
                this.outer.handleZIndexChange(data.object);
            }
        }
    };

    private VisibilityChangedListener = class extends BaseMementoAwareListener<Set<MementoAwareVisualObject>> {
        constructor(id: string, private outer: ZIndexSortedVisibleVisualObjectsManager) {
            super(id);
        }

        onNotify = (_visibleObjects: Set<MementoAwareVisualObject>): void => {
            this.outer.rebuildSortedArray();
        }
    };

    private _sortedVisibleVisualObjects: MementoAwareVisualObject[] = [];
    private _insertionOrderMap: WeakMap<MementoAwareVisualObject, number> = new WeakMap();
    private _objectPositions: WeakMap<MementoAwareVisualObject, number> = new WeakMap(); // O(1) removal lookup
    private _nextInsertionOrder: number = 0;

    constructor(canvasWorld: CanvasWorld, provider: IVisibilityProvider, id: string = 'z-index-sorted-manager') {
        super(canvasWorld, provider, id);

        // Initialize insertion order with existing objects
        for (const obj of this.provider.getAllObjects()) {
            this._insertionOrderMap.set(obj, this._nextInsertionOrder++);
        }

        // Create specific MementoAware listeners
        const insertionOrderListener = new this.InsertionOrderListener(`${id}_insertionOrder`, this);
        const cleanupListener = new this.InsertionOrderCleanupListener(`${id}_cleanup`, this);
        const zIndexListener = new this.ZIndexChangeListener(`${id}_zIndex`, this);
        const visibilityListener = new this.VisibilityChangedListener(`${id}_visibility`, this);

        // Subscribe to object added and removed to maintain insertion order
        this.provider.onObjectAdded.subscribe(insertionOrderListener);
        this.provider.onObjectRemoved.subscribe(cleanupListener);

        // Subscribe to z-index changes to maintain sort order
        this.provider.onObjectPropertyChanged.subscribe(zIndexListener);

        // Subscribe to visibility changes to rebuild sorted array
        this.onVisibleObjectsChanged.subscribe(visibilityListener);

        // Initialize the sorted array with current visible objects
        this.rebuildSortedArray();
    }

    private trackInsertionOrder(obj: MementoAwareVisualObject): void {
        this._insertionOrderMap.set(obj, this._nextInsertionOrder++);
    }

    private cleanupInsertionOrder(obj: MementoAwareVisualObject): void {
        this._insertionOrderMap.delete(obj);
    }

    getSortedVisibleObjects(): MementoAwareVisualObject[] {
        return this._sortedVisibleVisualObjects;
    }

    private rebuildSortedArray(): void {
        // Ensure _objectPositions is initialized
        if (!this._objectPositions) {
            this._objectPositions = new WeakMap();
        }

        // Ensure _insertionOrderMap is initialized
        if (!this._insertionOrderMap) {
            this._insertionOrderMap = new WeakMap();
        }

        this._sortedVisibleVisualObjects = Array.from(super.getVisibleObjects()).sort((a, b) => {
            // First compare by z-index
            if (a.zIndex !== b.zIndex) {
                return a.zIndex - b.zIndex;
            }
            // If z-index is the same, use insertion order
            const orderA = this._insertionOrderMap.get(a) ?? 0;
            const orderB = this._insertionOrderMap.get(b) ?? 0;
            return orderA - orderB;
        });

        // Update position tracking
        for (let i = 0; i < this._sortedVisibleVisualObjects.length; i++) {
            this._objectPositions.set(this._sortedVisibleVisualObjects[i], i);
        }
    }


    private insertObjectInSortedPosition(obj: MementoAwareVisualObject): void {
        // Ensure _objectPositions is initialized
        if (!this._objectPositions) {
            this._objectPositions = new WeakMap();
        }

        const insertionIndex = this.findInsertionPoint(obj);
        this._sortedVisibleVisualObjects.splice(insertionIndex, 0, obj);

        // Update positions for inserted object and all subsequent objects
        for (let i = insertionIndex; i < this._sortedVisibleVisualObjects.length; i++) {
            this._objectPositions.set(this._sortedVisibleVisualObjects[i], i);
        }
    }

    private removeObjectFromSorted(obj: MementoAwareVisualObject): void {
        // Ensure _objectPositions is initialized
        if (!this._objectPositions) {
            this._objectPositions = new WeakMap();
            return;
        }

        const index = this._objectPositions.get(obj);
        if (index !== undefined) {
            this._sortedVisibleVisualObjects.splice(index, 1);
            this._objectPositions.delete(obj);

            // Update positions for all subsequent objects
            for (let i = index; i < this._sortedVisibleVisualObjects.length; i++) {
                this._objectPositions.set(this._sortedVisibleVisualObjects[i], i);
            }
        }
    }

    private findInsertionPoint(obj: MementoAwareVisualObject): number {
        let left = 0;
        let right = this._sortedVisibleVisualObjects.length;

        while (left < right) {
            const mid = Math.floor((left + right) / 2);
            const midObj = this._sortedVisibleVisualObjects[mid];

            if (this.compareObjects(obj, midObj) < 0) {
                right = mid;
            } else {
                left = mid + 1;
            }
        }

        return left;
    }

    private compareObjects(a: MementoAwareVisualObject, b: MementoAwareVisualObject): number {
        // First compare by z-index
        if (a.zIndex !== b.zIndex) {
            return a.zIndex - b.zIndex;
        }

        // If z-index is the same, use insertion order
        const orderA = this._insertionOrderMap.get(a) ?? 0;
        const orderB = this._insertionOrderMap.get(b) ?? 0;
        return orderA - orderB;
    }

    private handleZIndexChange(obj: MementoAwareVisualObject): void {
        // Remove object from current position (O(1) lookup + O(n) position updates)
        this.removeObjectFromSorted(obj);
        // Insert it back in the correct position (O(log n) + O(n) position updates)
        this.insertObjectInSortedPosition(obj);
    }
}