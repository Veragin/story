import { WithMemento } from '../../MementoSystem/Memento/mementoTypes';
import { MementoAwareObserver } from '../../MementoSystem/MementoAwareObserver';

export interface TPoint {
    x: number;
    y: number;
}

export interface TSize {
    width: number;
    height: number;
}

/**
 * Manages 2D canvas coordinate system transformations between screen pixels and world coordinates.
 */
export class CanvasWorld implements WithMemento {
    private id: string;
    private _viewPosition: TPoint = { x: 0, y: 0 };
    private _pixelSizeInWorldUnits: TSize = { width: 1, height: 1 };

    public onViewPositionChange: MementoAwareObserver<TPoint>;
    public onPixelSizeChange: MementoAwareObserver<TSize>;

    constructor(id: string = 'canvas-world') {
        this.id = id;
        this.onViewPositionChange = new MementoAwareObserver<TPoint>(`${id}_viewPositionChange`);
        this.onPixelSizeChange = new MementoAwareObserver<TSize>(`${id}_pixelSizeChange`);
    }

    getId(): string {
        return this.id;
    }

    getObjectTypeName(): string {
        return this.constructor.name;
    }

    get viewPosition(): TPoint { return this._viewPosition; }
    set viewPosition(position: TPoint) {
        const oldPos = { ...this._viewPosition };
        this._viewPosition = position;
        // Only notify if changed
        if (oldPos.x !== position.x || oldPos.y !== position.y) {
            this.onViewPositionChange.notify(position);
        }
    }

    get pixelSizeInWorldUnits(): TSize { return this._pixelSizeInWorldUnits; }
    set pixelSizeInWorldUnits(size: TSize) {
        const oldSize = { ...this._pixelSizeInWorldUnits };
        this._pixelSizeInWorldUnits = {
            width: Math.max(0.00001, size.width),
            height: Math.max(0.00001, size.height)
        };
        // Only notify if changed
        if (Math.abs(oldSize.width - this._pixelSizeInWorldUnits.width) > 0.00001 ||
            Math.abs(oldSize.height - this._pixelSizeInWorldUnits.height) > 0.00001) {
            this.onPixelSizeChange.notify(this._pixelSizeInWorldUnits);
        }
    }

    /**
     * Perform atomic updates to both zoom and position without intermediate notifications
     */
    public atomicZoomAndPositionUpdate(updates: {
        pixelSizeInWorldUnits?: TSize;
        viewPosition?: TPoint;
    }): void {
        // Store old values for comparison
        const oldPixelSize = { ...this._pixelSizeInWorldUnits };
        const oldViewPosition = { ...this._viewPosition };

        // Update values directly without triggering setters
        if (updates.pixelSizeInWorldUnits !== undefined) {
            this._pixelSizeInWorldUnits = {
                width: Math.max(0.00001, updates.pixelSizeInWorldUnits.width),
                height: Math.max(0.00001, updates.pixelSizeInWorldUnits.height)
            };
        }

        if (updates.viewPosition !== undefined) {
            this._viewPosition = updates.viewPosition;
        }

        // Send notifications only for what actually changed
        if (Math.abs(this._pixelSizeInWorldUnits.width - oldPixelSize.width) > 0.00001 ||
            Math.abs(this._pixelSizeInWorldUnits.height - oldPixelSize.height) > 0.00001) {
            this.onPixelSizeChange.notify(this._pixelSizeInWorldUnits);
        }

        if (this._viewPosition.x !== oldViewPosition.x || this._viewPosition.y !== oldViewPosition.y) {
            this.onViewPositionChange.notify(this._viewPosition);
        }
    }

    /**
     * Atomic zoom at point - updates both zoom and position without glitches. Applies uniform zoom factor to both dimensions.
     */
    zoomAtPoint(screenPoint: TPoint, zoomFactor: number): void {
        // Calculate world point before zoom
        const worldPointBefore = this.screenToWorld(screenPoint);

        // Calculate new values
        const newPixelSize = {
            width: Math.max(0.00001, this._pixelSizeInWorldUnits.width / zoomFactor),
            height: Math.max(0.00001, this._pixelSizeInWorldUnits.height / zoomFactor)
        };

        // Temporarily update pixel size to calculate new world point
        const oldPixelSize = { ...this._pixelSizeInWorldUnits };
        this._pixelSizeInWorldUnits = newPixelSize;
        const worldPointAfter = this.screenToWorld(screenPoint);
        this._pixelSizeInWorldUnits = oldPixelSize; // Restore for atomic update

        // Calculate new view position
        const newViewPosition = {
            x: this._viewPosition.x + worldPointBefore.x - worldPointAfter.x,
            y: this._viewPosition.y + worldPointBefore.y - worldPointAfter.y
        };

        // Apply both updates atomically
        this.atomicZoomAndPositionUpdate({
            pixelSizeInWorldUnits: newPixelSize,
            viewPosition: newViewPosition
        });
    }

    /**
     * Atomic anisotropic zoom at point - allows separate zoom factors for width and height.
     */
    anisotropicZoomAtPoint(screenPoint: TPoint, zoomFactors: TSize): void {
        // Calculate world point before zoom
        const worldPointBefore = this.screenToWorld(screenPoint);

        // Calculate new values
        const newPixelSize = {
            width: Math.max(0.00001, this._pixelSizeInWorldUnits.width / zoomFactors.width),
            height: Math.max(0.00001, this._pixelSizeInWorldUnits.height / zoomFactors.height)
        };

        // Temporarily update pixel size to calculate new world point
        const oldPixelSize = { ...this._pixelSizeInWorldUnits };
        this._pixelSizeInWorldUnits = newPixelSize;
        const worldPointAfter = this.screenToWorld(screenPoint);
        this._pixelSizeInWorldUnits = oldPixelSize; // Restore for atomic update

        // Calculate new view position
        const newViewPosition = {
            x: this._viewPosition.x + worldPointBefore.x - worldPointAfter.x,
            y: this._viewPosition.y + worldPointBefore.y - worldPointAfter.y
        };

        // Apply both updates atomically
        this.atomicZoomAndPositionUpdate({
            pixelSizeInWorldUnits: newPixelSize,
            viewPosition: newViewPosition
        });
    }

    screenToWorld(screenPoint: TPoint): TPoint {
        return {
            x: this._viewPosition.x + (screenPoint.x * this._pixelSizeInWorldUnits.width),
            y: this._viewPosition.y + (screenPoint.y * this._pixelSizeInWorldUnits.height)
        };
    }

    worldToScreen(worldPoint: TPoint): TPoint {
        return {
            x: (worldPoint.x - this._viewPosition.x) / this._pixelSizeInWorldUnits.width,
            y: (worldPoint.y - this._viewPosition.y) / this._pixelSizeInWorldUnits.height
        };
    }

    screenDeltaToWorldDelta(screenDelta: TPoint): TPoint {
        return {
            x: screenDelta.x * this._pixelSizeInWorldUnits.width,
            y: screenDelta.y * this._pixelSizeInWorldUnits.height
        };
    }

    worldDeltaToScreenDelta(worldDelta: TPoint): TPoint {
        return {
            x: worldDelta.x / this._pixelSizeInWorldUnits.width,
            y: worldDelta.y / this._pixelSizeInWorldUnits.height
        };
    }

    getVisibleWorldBounds(canvasSize: TSize): { min: TPoint; max: TPoint } {
        const min = this.screenToWorld({ x: 0, y: 0 });
        const max = this.screenToWorld({ x: canvasSize.width, y: canvasSize.height });
        return { min, max };
    }

    getCenterViewPosition(canvasSize: TSize): TPoint {
        const visibleBounds = this.getVisibleWorldBounds(canvasSize);
        return {
            x: (visibleBounds.min.x + visibleBounds.max.x) / 2,
            y: (visibleBounds.min.y + visibleBounds.max.y) / 2
        };
    }

    pan(screenDelta: TPoint): void {
        const worldDelta = this.screenDeltaToWorldDelta(screenDelta);
        this.viewPosition = {
            x: this._viewPosition.x - worldDelta.x,
            y: this._viewPosition.y - worldDelta.y
        };
    }

    resetView(): void {
        this.atomicZoomAndPositionUpdate({
            viewPosition: { x: 0, y: 0 },
            pixelSizeInWorldUnits: { width: 1, height: 1 }
        });
    }

    resetViewPosition(): void {
        this.viewPosition = { x: 0, y: 0 };
    }

    getPixelSizeInWorldUnits(): TSize {
        return this._pixelSizeInWorldUnits;
    }
}