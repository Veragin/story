import { throttle } from 'code/utils/throttle';
import { VisualObject } from '../Node/VisualObject';
import { Observer } from 'code/utils/Observer';
import { CanvasWorld } from './CanvasWorld';
import { VisibleVisualObjectsManager, IVisibilityProvider, IVisibleVisualObjectsManager } from './VisibleVisualObjectsManager';

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
    getSortedVisibleObjects(): VisualObject[];
}

export class ZIndexSortedVisibleVisualObjectsManager extends VisibleVisualObjectsManager {
    private _sortedVisibleVisualObjects: VisualObject[] = [];
    private _insertionOrderMap: WeakMap<VisualObject, number> = new WeakMap();
    private _objectPositions: WeakMap<VisualObject, number> = new WeakMap(); // O(1) removal lookup
    private _nextInsertionOrder: number = 0;

    constructor(canvasWorld: CanvasWorld, provider: IVisibilityProvider) {
        super(canvasWorld, provider);

        // Initialize insertion order with existing objects
        for (const obj of this.provider.getAllObjects()) {
            this._insertionOrderMap.set(obj, this._nextInsertionOrder++);
        }

        // Subscribe to object added and removed to maintain insertion order
        this.provider.onObjectAdded.subscribe((obj) => {
            this._insertionOrderMap.set(obj, this._nextInsertionOrder++);
        });

        this.provider.onObjectRemoved.subscribe((obj) => {
            this._insertionOrderMap.delete(obj);
        });

        // Subscribe to z-index changes to maintain sort order
        this.provider.onObjectPropertyChanged.subscribe(({ object, property }) => {
            if (property === 'zIndex' && super.getVisibleObjects().has(object)) {
                this.handleZIndexChange(object);
            }
        });

        // Initialize the sorted array with current visible objects
        this.rebuildSortedArray();
    }

    getSortedVisibleObjects(): VisualObject[] {
        return this._sortedVisibleVisualObjects;
    }

    private rebuildSortedArray(): void {
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

    protected override handleObjectAdded(obj: VisualObject): void {
        // Track insertion order for new objects
        if (!this._insertionOrderMap.has(obj)) {
            this._insertionOrderMap.set(obj, this._nextInsertionOrder++);
        }

        const wasVisible = super.getVisibleObjects().has(obj);
        super.handleObjectAdded(obj);
        const isNowVisible = super.getVisibleObjects().has(obj);

        // Only update sorted array if visibility actually changed
        if (!wasVisible && isNowVisible) {
            this.insertObjectInSortedPosition(obj);
        }
    }

    protected override handleObjectRemoved(obj: VisualObject): void {
        const wasVisible = super.getVisibleObjects().has(obj);
        super.handleObjectRemoved(obj);

        // Only update sorted array if object was actually visible
        if (wasVisible) {
            this.removeObjectFromSorted(obj);
        }

        // Clean up insertion order tracking
        this._insertionOrderMap.delete(obj);
    }

    // Override for bulk visibility changes (like viewport changes)
    protected override checkAllVisualObjectsVisibility(): void {
        const previousVisibleObjects = new Set(this._sortedVisibleVisualObjects);
        super.checkAllVisualObjectsVisibility();
        const newVisibleObjects = super.getVisibleObjects();

        // For bulk changes, it might be more efficient to rebuild if many objects changed
        const changedCount = [...previousVisibleObjects].filter(obj => !newVisibleObjects.has(obj)).length +
            [...newVisibleObjects].filter(obj => !previousVisibleObjects.has(obj)).length;

        if (changedCount > newVisibleObjects.size * 0.5) {
            // If more than 50% of objects changed, rebuild is more efficient
            this.rebuildSortedArray();
        } else {
            // Otherwise, use incremental updates
            this.updateSortedArrayEfficiently(newVisibleObjects, previousVisibleObjects);
        }
    }

    private insertObjectInSortedPosition(obj: VisualObject): void {
        const insertionIndex = this.findInsertionPoint(obj);
        this._sortedVisibleVisualObjects.splice(insertionIndex, 0, obj);

        // Update positions for inserted object and all subsequent objects
        for (let i = insertionIndex; i < this._sortedVisibleVisualObjects.length; i++) {
            this._objectPositions.set(this._sortedVisibleVisualObjects[i], i);
        }
    }

    private removeObjectFromSorted(obj: VisualObject): void {
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

    private findInsertionPoint(obj: VisualObject): number {
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

    private compareObjects(a: VisualObject, b: VisualObject): number {
        // First compare by z-index
        if (a.zIndex !== b.zIndex) {
            return a.zIndex - b.zIndex;
        }

        // If z-index is the same, use insertion order
        const orderA = this._insertionOrderMap.get(a) ?? 0;
        const orderB = this._insertionOrderMap.get(b) ?? 0;
        return orderA - orderB;
    }

    private updateSortedArrayEfficiently(newVisibleObjects: Set<VisualObject>, previousVisibleObjects: Set<VisualObject>): void {
        // Find objects to remove (were visible, now not visible)
        const objectsToRemove: VisualObject[] = [];
        for (const obj of previousVisibleObjects) {
            if (!newVisibleObjects.has(obj)) {
                objectsToRemove.push(obj);
            }
        }

        // Find objects to add (weren't visible, now visible)
        const objectsToAdd: VisualObject[] = [];
        for (const obj of newVisibleObjects) {
            if (!previousVisibleObjects.has(obj)) {
                objectsToAdd.push(obj);
            }
        }

        // Remove objects efficiently (O(1) lookup, but O(n) position updates)
        for (const obj of objectsToRemove) {
            this.removeObjectFromSorted(obj);
        }

        // Add objects efficiently using binary search insertion
        for (const obj of objectsToAdd) {
            this.insertObjectInSortedPosition(obj);
        }
    }

    protected override handleVisualObjectPropertyChanged(obj: VisualObject, property: string): void {
        super.handleVisualObjectPropertyChanged(obj, property);

        if (property === 'zIndex' && super.getVisibleObjects().has(obj)) {
            // Remove and re-add to maintain proper sorting
            this.handleZIndexChange(obj);
        }
    }

    private handleZIndexChange(obj: VisualObject): void {
        // Remove object from current position (O(1) lookup + O(n) position updates)
        this.removeObjectFromSorted(obj);
        // Insert it back in the correct position (O(log n) + O(n) position updates)
        this.insertObjectInSortedPosition(obj);
    }
}