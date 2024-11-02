import { Observer } from 'code/utils/Observer';
import { HoverableVisualObject } from './HoverableVisualObject';

export abstract class ClickableVisualObject extends HoverableVisualObject {
    private _onClick = new Observer<ClickableVisualObject>();
    private _isClickable: boolean = true;
    private _onRightDown = new Observer<ClickableVisualObject>();

    get onClick(): Observer<ClickableVisualObject> {
        return this._onClick;
    }

    get onRightDown(): Observer<ClickableVisualObject> {
        return this._onRightDown;
    }

    handleClick(point: TPoint): void {
        if (this._isClickable && this.isPointInside(point)) {
            this._onClick.notify(this);
        }
    }

    handleRightDown(point: TPoint): void {
        if (this._isClickable && this.isPointInside(point)) {
            this._onRightDown.notify(this);
        }
    }

    setClickable(clickable: boolean): void {
        this._isClickable = clickable;
    }

    isClickable(): boolean {
        return this._isClickable;
    }
}