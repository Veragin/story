import { Observer } from 'code/utils/Observer';
import { VisualObject, MementoAwareVisualObject } from './VisualObject';
import { MementoAwareObserver } from '../../MementoSystem/MementoAwareObserver';

export abstract class HoverableVisualObject extends VisualObject {
    private _onHoverEnter = new Observer<HoverableVisualObject>();
    private _onHoverExit = new Observer<HoverableVisualObject>();
    private _isHoverable: boolean = true;
    private _isHovered: boolean = false;

    get onHoverEnter(): Observer<HoverableVisualObject> {
        return this._onHoverEnter;
    }

    get onHoverExit(): Observer<HoverableVisualObject> {
        return this._onHoverExit;
    }

    isPointInside(point: TPoint): boolean {
        const pos = this.getPosition();
        const size = this.getSize();

        return point.x >= pos.x && point.x <= pos.x + size.width && point.y >= pos.y && point.y <= pos.y + size.height;
    }

    handleHover(point: TPoint): void {
        if (!this._isHoverable) return;

        const isInside = this.isPointInside(point);
        if (isInside && !this._isHovered) {
            this._isHovered = true;
            this._onHoverEnter.notify(this);
        } else if (!isInside && this._isHovered) {
            this._isHovered = false;
            this._onHoverExit.notify(this);
        }
    }

    setHoverable(hoverable: boolean): void {
        this._isHoverable = hoverable;
        if (!hoverable && this._isHovered) {
            this._isHovered = false;
            this._onHoverExit.notify(this);
        }
    }

    isHoverable(): boolean {
        return this._isHoverable;
    }

    isHovered(): boolean {
        return this._isHovered;
    }
}


/**
 * MementoAware variant of HoverableVisualObject
 */
export abstract class MementoAwareHoverableVisualObject extends MementoAwareVisualObject {
    private _onHoverEnter = new MementoAwareObserver<MementoAwareHoverableVisualObject>(`${this.getId()}_hoverEnter`);
    private _onHoverExit = new MementoAwareObserver<MementoAwareHoverableVisualObject>(`${this.getId()}_hoverExit`);
    private _isHoverable: boolean = true;
    private _isHovered: boolean = false;

    get onHoverEnter(): MementoAwareObserver<MementoAwareHoverableVisualObject> {
        return this._onHoverEnter;
    }

    get onHoverExit(): MementoAwareObserver<MementoAwareHoverableVisualObject> {
        return this._onHoverExit;
    }

    constructor(id: string, position: TPoint, size: TSize, zIndex: number = 0) {
        super(id, position, size, zIndex);
        this._onHoverEnter = new MementoAwareObserver<MementoAwareHoverableVisualObject>(`${id}_hoverEnter`);
        this._onHoverExit = new MementoAwareObserver<MementoAwareHoverableVisualObject>(`${id}_hoverExit`);
    }

    isPointInside(point: TPoint): boolean {
        const pos = this.getPosition();
        const size = this.getSize();

        return point.x >= pos.x && point.x <= pos.x + size.width && point.y >= pos.y && point.y <= pos.y + size.height;
    }

    handleHover(point: TPoint): void {
        if (!this._isHoverable) return;

        const isInside = this.isPointInside(point);
        if (isInside && !this._isHovered) {
            this._isHovered = true;
            this._onHoverEnter.notify(this);
        } else if (!isInside && this._isHovered) {
            this._isHovered = false;
            this._onHoverExit.notify(this);
        }
    }

    setHoverable(hoverable: boolean): void {
        this._isHoverable = hoverable;
        if (!hoverable && this._isHovered) {
            this._isHovered = false;
            this._onHoverExit.notify(this);
        }
    }

    isHoverable(): boolean {
        return this._isHoverable;
    }

    isHovered(): boolean {
        return this._isHovered;
    }
}
