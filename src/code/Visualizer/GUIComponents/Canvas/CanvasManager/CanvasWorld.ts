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

    zoomAtPoint(screenPoint: TPoint, zoomFactor: number): void {
        const worldPointBefore = this.screenToWorld(screenPoint);
        this.pixelSizeInWorldUnits *= zoomFactor;
        const worldPointAfter = this.screenToWorld(screenPoint);
        
        this._viewPosition.x += worldPointBefore.x - worldPointAfter.x;
        this._viewPosition.y += worldPointBefore.y - worldPointAfter.y;
        
        // These will only notify if values actually changed
        this.onViewPositionChange.notify(this._viewPosition);
        this.onPixelSizeChange.notify(this._pixelSizeInWorldUnits);
    }

    pan(targetPosition: TPoint): void {
        this._viewPosition.x -= this.screenLengthToWorld(targetPosition.x);
        this._viewPosition.y -= this.screenLengthToWorld(targetPosition.y);
        
        this.onViewPositionChange.notify(this._viewPosition);
    }

    resetView(): void {
        this._viewPosition = { x: 0, y: 0 };
        this._pixelSizeInWorldUnits = 1;
        
        this.onViewPositionChange.notify(this._viewPosition);
        this.onPixelSizeChange.notify(this._pixelSizeInWorldUnits);
    }

    resetViewPosition(): void {
        this._viewPosition = { x: 0, y: 0 };
        
        this.onViewPositionChange.notify(this._viewPosition);
    }

    getPixelSizeInWorldUnits(): number {
        return this._pixelSizeInWorldUnits;
    }
}