import { ConditionalObserver } from 'code/utils/Observer';

export class CanvasWorld {
    private _viewPosition: TPoint = { x: 0, y: 0 };
    private _pixelSizeInWorldUnits: number = 1;

    public onViewPositionChange = new ConditionalObserver<TPoint>(
        (newPos, lastPos) => !lastPos || newPos.x !== lastPos.x || newPos.y !== lastPos.y
    );

    public onPixelSizeChange = new ConditionalObserver<number>(
        (newSize, lastSize) => !lastSize || Math.abs(newSize - lastSize) > 0.00001
    );

    get viewPosition(): TPoint { return this._viewPosition; }
    set viewPosition(position: TPoint) {
        this._viewPosition = position;
        this.onViewPositionChange.notify(position);
    }

    get pixelSizeInWorldUnits(): number { return this._pixelSizeInWorldUnits; }
    set pixelSizeInWorldUnits(size: number) {
        this._pixelSizeInWorldUnits = Math.max(0.00001, size);
        this.onPixelSizeChange.notify(this._pixelSizeInWorldUnits);
    }

    /**
     * Perform atomic updates to both zoom and position without intermediate notifications
     */
    public atomicZoomAndPositionUpdate(updates: {
        pixelSizeInWorldUnits?: number;
        viewPosition?: TPoint;
    }): void {
        // Store old values for comparison
        const oldPixelSize = this._pixelSizeInWorldUnits;
        const oldViewPosition = { ...this._viewPosition };

        // Update values directly without triggering setters
        if (updates.pixelSizeInWorldUnits !== undefined) {
            this._pixelSizeInWorldUnits = Math.max(0.00001, updates.pixelSizeInWorldUnits);
        }

        if (updates.viewPosition !== undefined) {
            this._viewPosition = updates.viewPosition;
        }

        // Send notifications only for what actually changed
        if (Math.abs(this._pixelSizeInWorldUnits - oldPixelSize) > 0.00001) {
            this.onPixelSizeChange.notify(this._pixelSizeInWorldUnits);
        }

        if (this._viewPosition.x !== oldViewPosition.x || this._viewPosition.y !== oldViewPosition.y) {
            this.onViewPositionChange.notify(this._viewPosition);
        }
    }

    /**
     * Atomic zoom at point - updates both zoom and position without glitches
     */
    zoomAtPoint(screenPoint: TPoint, zoomFactor: number): void {
        // Calculate world point before zoom
        const worldPointBefore = this.screenToWorld(screenPoint);

        // Calculate new values
        const newPixelSize = Math.max(0.00001, this._pixelSizeInWorldUnits * zoomFactor);

        // Temporarily update pixel size to calculate new world point
        const oldPixelSize = this._pixelSizeInWorldUnits;
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
            x: this._viewPosition.x + (screenPoint.x * this._pixelSizeInWorldUnits),
            y: this._viewPosition.y + (screenPoint.y * this._pixelSizeInWorldUnits)
        };
    }

    worldToScreen(worldPoint: TPoint): TPoint {
        return {
            x: (worldPoint.x - this._viewPosition.x) / this._pixelSizeInWorldUnits,
            y: (worldPoint.y - this._viewPosition.y) / this._pixelSizeInWorldUnits
        };
    }

    screenLengthToWorld(length: number): number {
        return length * this._pixelSizeInWorldUnits;
    }

    worldLengthToScreen(length: number): number {
        return length / this._pixelSizeInWorldUnits;
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

    pan(targetPosition: TPoint): void {
        this.viewPosition = {
            x: this._viewPosition.x - this.screenLengthToWorld(targetPosition.x),
            y: this._viewPosition.y - this.screenLengthToWorld(targetPosition.y)
        };
    }

    resetView(): void {
        this.atomicZoomAndPositionUpdate({
            viewPosition: { x: 0, y: 0 },
            pixelSizeInWorldUnits: 1
        });
    }

    resetViewPosition(): void {
        this.viewPosition = { x: 0, y: 0 };
    }

    getPixelSizeInWorldUnits(): number {
        return this._pixelSizeInWorldUnits;
    }
}