import { Observer } from 'code/utils/Observer';
import { HoverableVisualObject, MementoAwareHoverableVisualObject } from './HoverableVisualObject';
import { MementoAwareObserver } from '../../MementoSystem/MementoAwareObserver';

export abstract class ClickableVisualObject extends HoverableVisualObject {
    private _onClick = new Observer<ClickableVisualObject>();
    private _onDbClick = new Observer<ClickableVisualObject>();
    private _isClickable: boolean = true;
    private _onRightDown = new Observer<ClickableVisualObject>();

    get onClick(): Observer<ClickableVisualObject> {
        return this._onClick;
    }

    get onDbClick(): Observer<ClickableVisualObject> {
        return this._onDbClick;
    }

    get onRightDown(): Observer<ClickableVisualObject> {
        return this._onRightDown;
    }

    /**
     * Handle click event on this object
     * @param point The world point where the click occurred
     * @returns true if the click was handled and should not propagate to lower objects, false otherwise
     */
    handleClick(point: TPoint): boolean {
        if (this._isClickable && this.isPointInside(point)) {
            this._onClick.notify(this);
            return this.shouldStopClickPropagation(point);
        }
        return false; // Not handled, allow propagation
    }

    /**
     * Handle double-click event on this object
     * @param point The world point where the double-click occurred
     * @returns true if the click was handled and should not propagate to lower objects, false otherwise
     */
    handleDbClick(point: TPoint): boolean {
        if (this._isClickable && this.isPointInside(point)) {
            this._onDbClick.notify(this);
            return this.shouldStopDbClickPropagation(point);
        }
        return false; // Not handled, allow propagation
    }

    /**
     * Handle right mouse down event on this object
     * @param point The world point where the right mouse down occurred
     * @returns true if the event was handled and should not propagate to lower objects, false otherwise
     */
    handleRightDown(point: TPoint): boolean {
        if (this._isClickable && this.isPointInside(point)) {
            this._onRightDown.notify(this);
            return this.shouldStopRightDownPropagation(point);
        }
        return false; // Not handled, allow propagation
    }

    /**
     * Override this method to control click propagation behavior
     * @param point The world point where the click occurred
     * @returns true to stop propagation to lower objects, false to allow it
     */
    protected shouldStopClickPropagation(point: TPoint): boolean {
        return true; // By default, stop propagation when clicked
    }

    /**
     * Override this method to control double-click propagation behavior
     * @param point The world point where the double-click occurred
     * @returns true to stop propagation to lower objects, false to allow it
     */
    protected shouldStopDbClickPropagation(point: TPoint): boolean {
        return true; // By default, stop propagation when double-clicked
    }

    /**
     * Override this method to control right mouse down propagation behavior
     * @param point The world point where the right mouse down occurred
     * @returns true to stop propagation to lower objects, false to allow it
     */
    protected shouldStopRightDownPropagation(point: TPoint): boolean {
        return true; // By default, stop propagation when right-clicked
    }

    setClickable(clickable: boolean): void {
        this._isClickable = clickable;
    }

    isClickable(): boolean {
        return this._isClickable;
    }
}


/**
 * MementoAware variant of ClickableVisualObject
 */
export abstract class MementoAwareClickableVisualObject extends MementoAwareHoverableVisualObject {
    private _onClick = new MementoAwareObserver<MementoAwareClickableVisualObject>(`${this.getId()}_click`);
    private _onDbClick = new MementoAwareObserver<MementoAwareClickableVisualObject>(`${this.getId()}_dbClick`);
    private _isClickable: boolean = true;
    private _onRightDown = new MementoAwareObserver<MementoAwareClickableVisualObject>(`${this.getId()}_rightDown`);

    get onClick(): MementoAwareObserver<MementoAwareClickableVisualObject> {
        return this._onClick;
    }

    get onDbClick(): MementoAwareObserver<MementoAwareClickableVisualObject> {
        return this._onDbClick;
    }

    get onRightDown(): MementoAwareObserver<MementoAwareClickableVisualObject> {
        return this._onRightDown;
    }

    constructor(id: string, position: TPoint, size: TSize, zIndex: number = 0) {
        super(id, position, size, zIndex);
        this._onClick = new MementoAwareObserver<MementoAwareClickableVisualObject>(`${id}_click`);
        this._onDbClick = new MementoAwareObserver<MementoAwareClickableVisualObject>(`${id}_dbClick`);
        this._onRightDown = new MementoAwareObserver<MementoAwareClickableVisualObject>(`${id}_rightDown`);
    }

    /**
     * Handle click event on this object
     * @param point The world point where the click occurred
     * @returns true if the click was handled and should not propagate to lower objects, false otherwise
     */
    handleClick(point: TPoint): boolean {
        if (this._isClickable && this.isPointInside(point)) {
            this._onClick.notify(this);
            return this.shouldStopClickPropagation(point);
        }
        return false;
    }

    /**
     * Handle double-click event on this object
     * @param point The world point where the double-click occurred
     * @returns true if the click was handled and should not propagate to lower objects, false otherwise
     */
    handleDbClick(point: TPoint): boolean {
        if (this._isClickable && this.isPointInside(point)) {
            this._onDbClick.notify(this);
            return this.shouldStopDbClickPropagation(point);
        }
        return false;
    }

    /**
     * Handle right mouse down event on this object
     * @param point The world point where the right mouse down occurred
     * @returns true if the event was handled and should not propagate to lower objects, false otherwise
     */
    handleRightDown(point: TPoint): boolean {
        if (this._isClickable && this.isPointInside(point)) {
            this._onRightDown.notify(this);
            return this.shouldStopRightDownPropagation(point);
        }
        return false;
    }

    /**
     * Override this method to control click propagation behavior
     * @param point The world point where the click occurred
     * @returns true to stop propagation to lower objects, false to allow it
     */
    protected shouldStopClickPropagation(point: TPoint): boolean {
        return true;
    }

    /**
     * Override this method to control double-click propagation behavior
     * @param point The world point where the double-click occurred
     * @returns true to stop propagation to lower objects, false to allow it
     */
    protected shouldStopDbClickPropagation(point: TPoint): boolean {
        return true;
    }

    /**
     * Override this method to control right mouse down propagation behavior
     * @param point The world point where the right mouse down occurred
     * @returns true to stop propagation to lower objects, false to allow it
     */
    protected shouldStopRightDownPropagation(point: TPoint): boolean {
        return true;
    }

    setClickable(clickable: boolean): void {
        this._isClickable = clickable;
    }

    isClickable(): boolean {
        return this._isClickable;
    }
}