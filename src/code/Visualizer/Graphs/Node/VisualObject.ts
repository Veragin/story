import { Observer } from "code/Visualizer/Observer";

/**
 * Base class for any visual object that can be drawn on canvas
 */
export abstract class VisualObject {
    protected realPosition: TPoint;
    protected canvasPosition: TPoint;
    protected size: TSize;
    private _onPropertyChanged = new Observer<VisualObject>();
    private _automaticDraw: boolean = true;
    private _zIndex: number = 0;


    get onPropertyChanged(): Observer<VisualObject> {
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
        this.redraw(changed);
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
        return this._automaticDraw;
    }

    setRealPosition(position: TPoint): void {
        this.realPosition = position;
        this.setCanvasPosition(position);
    }

    setCanvasPosition(position: TPoint): void {
        let changed = this.canvasPosition.x !== position.x 
            || this.canvasPosition.y !== position.y;
        this.canvasPosition = position;
        this.redraw(changed);
    }

    setSize(size: TSize): void {
        let changed = this.size.width !== size.width 
            || this.size.height !== size.height;
        this.size = size;
        this.redraw(changed);
    }

    setAutomaticDraw(automaticDraw: boolean): void {
        this._automaticDraw = automaticDraw;
    }
    

    protected redraw(change: boolean): void {
        if(this._automaticDraw && change) {
            this.onPropertyChanged.notify(this);
        }
    }
}
