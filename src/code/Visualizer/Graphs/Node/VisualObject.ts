import { Observer } from "code/Visualizer/Observer";
import { Point } from "./Point";
import { Size } from "./Size";
import zIndex from "@mui/material/styles/zIndex";
import { set } from "mobx";

/**
 * Base class for any visual object that can be drawn on canvas
 */
export abstract class VisualObject {
    protected realPosition: Point;
    protected canvasPosition: Point;
    protected size: Size;
    private _onPropertyChanged = new Observer<VisualObject>();
    private _automaticDraw: boolean = true;
    private _zIndex: number = 0;


    get onPropertyChanged(): Observer<VisualObject> {
        return this._onPropertyChanged;
    }

    get zIndex(): number {
        return this._zIndex;
    }

    constructor(realPosition: Point, size: Size, zIndex: number = 0) {
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

    getRealPosition(): Point {
        return this.realPosition;
    }

    getCanvasPosition(): Point {
        return this.canvasPosition;
    }

    getSize(): Size {
        return this.size;
    }

    getAutomaticDraw(): boolean {
        return this._automaticDraw;
    }

    setRealPosition(position: Point): void {
        this.realPosition = position;
        this.setCanvasPosition(position);
    }

    setCanvasPosition(position: Point): void {
        let changed = this.canvasPosition.x !== position.x 
            || this.canvasPosition.y !== position.y;
        this.canvasPosition = position;
        this.redraw(changed);
    }

    setSize(size: Size): void {
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
