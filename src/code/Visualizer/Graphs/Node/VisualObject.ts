import { Observer } from 'code/utils/Observer';

export type TVisualObjectPropertyChangeArgs = {
    property: string;
    VisualObject: VisualObject;
};

export const visualObjectProperties = {
    RealPosition: 'RealPosition',
    CanvasPosition: 'CanvasPosition',
    Size: 'Size',
    ZIndex: 'ZIndex',
};

/**
 * Base class for any visual object that can be drawn on canvas
 */
export abstract class VisualObject {
    protected realPosition: TPoint;
    protected canvasPosition: TPoint;
    protected size: TSize;
    private automaticDraw: boolean = true;
    private _onPropertyChanged = new Observer<TVisualObjectPropertyChangeArgs>();
    private _zIndex: number = 0;

    get onPropertyChanged(): Observer<TVisualObjectPropertyChangeArgs> {
        return this._onPropertyChanged;
    }

    get zIndex(): number {
        return this._zIndex;
    }

    constructor(realPosition: TPoint, size: TSize, zIndex: number = 0) {
        this.realPosition = realPosition;
        this.canvasPosition = { ...realPosition };
        this.size = size;
        this._zIndex = zIndex;
    }

    abstract draw(ctx: CanvasRenderingContext2D): void;

    setZIndex(zIndex: number): void {
        const changed = this._zIndex !== zIndex;
        this._zIndex = zIndex;
        this.redraw(changed, visualObjectProperties.ZIndex);
    }

    getRealPosition(): TPoint {
        return this.realPosition;
    }

    getCanvasPosition(): TPoint {
        return this.canvasPosition;
    }

    getSize(): TSize {
        return this.size;
    }

    getAutomaticDraw(): boolean {
        return this.automaticDraw;
    }

    setRealPosition(position: TPoint): void {
        this.realPosition = position;
        this.setCanvasPosition(position);
    }

    setCanvasPosition(position: TPoint): void {
        let changed = this.canvasPosition.x !== position.x || this.canvasPosition.y !== position.y;
        this.canvasPosition = position;
        this.redraw(changed, visualObjectProperties.CanvasPosition);
    }

    setSize(size: TSize): void {
        let changed = this.size.width !== size.width || this.size.height !== size.height;
        this.size = size;
        this.redraw(changed, visualObjectProperties.Size);
    }

    setAutomaticDraw(automaticDraw: boolean): void {
        this.automaticDraw = automaticDraw;
    }

    /**
     * @param change
     * @param reason why the redraw is called, name of the property that changed,
     * or name of event that triggered the redraw
     */
    protected redraw(change: boolean, reason: string): void {
        if (this.automaticDraw && change) {
            this.onPropertyChanged.notify({
                property: reason,
                VisualObject: this,
            });
        }
    }
}
