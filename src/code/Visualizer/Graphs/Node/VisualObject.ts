import { Observer } from "code/Visualizer/Observer";
import { Point } from "./Point";
import { Size } from "./Size";

/**
 * Base class for any visual object that can be drawn on canvas
 */
export abstract class VisualObject {
    protected realPosition: Point;
    protected canvasPosition: Point;
    protected size: Size;
    private _onPropertyChanged = new Observer<VisualObject>();
    private automaticDraw: boolean = true;


    get onPropertyChanged(): Observer<VisualObject> {
        return this._onPropertyChanged;
    }

    constructor(realPosition: Point, size: Size) {
        this.realPosition = realPosition;
        this.canvasPosition = { ...realPosition };
        this.size = size;
    }

    abstract draw(ctx: CanvasRenderingContext2D): void;

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
        return this.automaticDraw;
    }

    setRealPosition(position: Point): void {
        this.realPosition = position;
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
        this.automaticDraw = automaticDraw;
    }
    

    protected redraw(change: boolean): void {
        if(this.automaticDraw && change) {
            this.onPropertyChanged.notify(this);
        }
    }
}
