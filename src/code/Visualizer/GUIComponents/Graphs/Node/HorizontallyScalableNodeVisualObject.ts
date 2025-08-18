import { BorderConfig } from './BorderConfig';
import { NodeVisualObject } from './NodeVisualObject';
import { VisualObject } from './VisualObject';
import { Observer } from 'code/utils/Observer';

export class HorizontallyScalableNodeVisualObject extends NodeVisualObject {
    private _isResizing: boolean = false;
    private _resizeHandleWidth: number = 10;
    private _minWidth: number = 50;
    private _resizeSide: 'left' | 'right' | null = null;
    private _isHorizontallyResizingEnabled: boolean = true;
    private _onHorizontalResize = new Observer<HorizontallyScalableNodeVisualObject>();

    get onHorizontalResize(): Observer<HorizontallyScalableNodeVisualObject> {
        return this._onHorizontalResize;
    }

    constructor(
        realPosition: TPoint,
        size: TSize,
        border: BorderConfig,
        content: VisualObject,
        backgroundColor: string = '#ffffff',
        zIndex: number = 0
    ) {
        super(realPosition, size, border, content, backgroundColor, zIndex);
    }

    draw(ctx: CanvasRenderingContext2D): void {
        super.draw(ctx);

        if (!this._isHorizontallyResizingEnabled) {
            return;
        }

        // Draw resize handles
        ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';

        // Left handle
        if (this.isMouseOverResizeHandle(this._lastMousePosition)?.side === 'left') {
            ctx.fillRect(this.position.x, this.position.y, this._resizeHandleWidth, this.size.height);
        }

        // Right handle
        if (this.isMouseOverResizeHandle(this._lastMousePosition)?.side === 'right') {
            ctx.fillRect(
                this.position.x + this.size.width - this._resizeHandleWidth,
                this.position.y,
                this._resizeHandleWidth,
                this.size.height
            );
        }
    }

    private _lastMousePosition: TPoint = { x: 0, y: 0 };

    override handleHover(point: TPoint): void {
        this._lastMousePosition = point;
        super.handleHover(point);

        // Update cursor based on position
        const resizeInfo = this.isMouseOverResizeHandle(point);
        if (resizeInfo && this._isHorizontallyResizingEnabled) {
            document.body.style.cursor = 'ew-resize';
        } else if (!this.isDragging()) {
            document.body.style.cursor = 'default';
        }
    }

    private isMouseOverResizeHandle(point: TPoint): { side: 'left' | 'right' } | null {
        if (!point) return null;

        // Check left handle
        if (
            point.x >= this.position.x &&
            point.x <= this.position.x + this._resizeHandleWidth &&
            point.y >= this.position.y &&
            point.y <= this.position.y + this.size.height
        ) {
            return { side: 'left' };
        }

        // Check right handle
        if (
            point.x >= this.position.x + this.size.width - this._resizeHandleWidth &&
            point.x <= this.position.x + this.size.width &&
            point.y >= this.position.y &&
            point.y <= this.position.y + this.size.height
        ) {
            return { side: 'right' };
        }

        return null;
    }

    override startDrag(point: TPoint): void {
        const resizeInfo = this.isMouseOverResizeHandle(point);
        if (resizeInfo && this._isHorizontallyResizingEnabled) {
            this._isResizing = true;
            this._resizeSide = resizeInfo.side;
            document.body.style.cursor = 'ew-resize';
        } else {
            super.startDrag(point);
        }
    }

    override drag(point: TPoint): void {
        if (this._isResizing && this._resizeSide) {
            let newWidth: number;
            let newX: number = this.position.x;

            if (this._resizeSide === 'right') {
                newWidth = Math.max(this._minWidth, point.x - this.position.x);
            } else {
                const rightEdge = this.position.x + this.size.width;
                newX = Math.min(point.x, rightEdge - this._minWidth);
                newWidth = rightEdge - newX;
            }

            // Update size and position
            this.size = {
                width: newWidth,
                height: this.size.height,
            };

            if (this._resizeSide === 'left') {
                this.setPosition({ x: newX, y: this.position.y });
            }

            // Update content position
            const newContentPosition = this.getContentPosition();
            this.getContent().setPosition(newContentPosition);

            this.redraw(true, 'HorizontalResize');
        } else {
            super.drag(point);
        }
    }

    override endDrag(point: TPoint): void {
        if (this._isResizing) {
            this._isResizing = false;
            this._resizeSide = null;
            document.body.style.cursor = 'default';
        } else {
            super.endDrag(point);
        }
    }

    setHorizontallyResizingEnabled(enabled: boolean): void {
        if (!enabled && this._isHorizontallyResizingEnabled) {
            this._isResizing = false;
            this._resizeSide = null;
            document.body.style.cursor = 'default';
        }

        this._isHorizontallyResizingEnabled = enabled;
    }
}
