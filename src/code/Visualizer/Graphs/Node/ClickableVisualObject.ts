import { Observer } from 'code/utils/Observer';
import { HoverableVisualObject } from './HoverableVisualObject';

export abstract class ClickableVisualObject extends HoverableVisualObject {
    private _onClick = new Observer<ClickableVisualObject>();
    private _isClickable: boolean = true;

    get onClick(): Observer<ClickableVisualObject> {
        return this._onClick;
    }

    handleClick(point: TPoint): void {
        if (this._isClickable && this.isPointInside(point)) {
            this._onClick.notify(this);
        }
    }

    setClickable(clickable: boolean): void {
        this._isClickable = clickable;
    }

    isClickable(): boolean {
        return this._isClickable;
    }
}

export const selectableVisualProperties = {
    isSelected: 'isSelected',
};

export abstract class SelectableVisualObject extends ClickableVisualObject {
    private _isSelected: boolean = false;

    get isSelected(): boolean {
        return this._isSelected;
    }

    setSelected(selected: boolean): void {
        this._isSelected = selected;
        this.redraw(true, selectableVisualProperties.isSelected);
    }
}