import { Observer, Listener } from "code/utils/Observer";
import { WithMemento } from "../../MementoSystem/Memento/mementoTypes";
import { IMementoAwareListener, MementoAwareObserver } from "../../MementoSystem/MementoAwareObserver";


export type TVisualObjectPropertyChangeArgs = {
    property: string;
    VisualObject: VisualObject;
};

export type TMementoAwareVisualObjectPropertyChangeArgs = {
    property: string;
    VisualObject: MementoAwareVisualObject;
};

export const visualObjectProperties = {
    position: 'position',
    Size: 'Size',
    ZIndex: 'ZIndex',
};

/**
 * Base class for any visual object that can be drawn on canvas
 */
export abstract class VisualObject {
    protected position: TPoint;
    protected size: TSize;
    private _automaticDraw: boolean = true;
    private _onPropertyChanged: Observer<TVisualObjectPropertyChangeArgs>;
    private _zIndex: number = 0;

    get onPropertyChanged(): Observer<TVisualObjectPropertyChangeArgs> {
        return this._onPropertyChanged;
    }

    get zIndex(): number {
        return this._zIndex;
    }

    constructor(position: TPoint, size: TSize, zIndex: number = 0) {
        this.position = position;
        this.size = size;
        this._zIndex = zIndex;
        this._onPropertyChanged = new Observer<TVisualObjectPropertyChangeArgs>();
    }

    /**
     * Subscribe a listener to property change events
     */
    subscribeToPropertyChanges(listener: Listener<TVisualObjectPropertyChangeArgs>): void {
        this._onPropertyChanged.subscribe(listener);
    }

    /**
     * Unsubscribe a listener from property change events
     */
    unsubscribeFromPropertyChanges(listener: Listener<TVisualObjectPropertyChangeArgs>): void {
        this._onPropertyChanged.unsubscribe(listener);
    }

    abstract draw(ctx: CanvasRenderingContext2D): void;

    setZIndex(zIndex: number): void {
        const changed = this._zIndex !== zIndex;
        this._zIndex = zIndex;
        this.redraw(changed, visualObjectProperties.ZIndex);
    }

    getPosition(): TPoint {
        return this.position;
    }

    getSize(): TSize {
        return this.size;
    }

    getAutomaticDraw(): boolean {
        return this._automaticDraw;
    }

    setX(x: number) {
        this.position.x = x;
        this.redraw(true, visualObjectProperties.position);
    }

    setY(y: number) {
        this.position.y = y;
        this.redraw(true, visualObjectProperties.position);
    }

    setW(w: number) {
        this.size.width = w;
        this.redraw(true, visualObjectProperties.Size);
    }

    setH(h: number) {
        this.size.height = h;
        this.redraw(true, visualObjectProperties.Size);
    }

    setPosition(position: TPoint): void {
        let changed = this.position.x !== position.x || this.position.y !== position.y;
        this.position = position;
        this.redraw(changed, visualObjectProperties.position);
    }

    setSize(size: TSize): void {
        let changed = this.size.width !== size.width || this.size.height !== size.height;
        this.size = size;
        this.redraw(changed, visualObjectProperties.Size);
    }

    setAutomaticDraw(automaticDraw: boolean): void {
        this._automaticDraw = automaticDraw;
    }

    /**
     * @param change
     * @param reason why the redraw is called, name of the property that changed,
     * or name of event that triggered the redraw
     */
    protected redraw(change: boolean, reason: string): void {
        if (this._automaticDraw && change) {
            this._onPropertyChanged.notify({
                property: reason,
                VisualObject: this,
            });
        }
    }
}

/**
 * MementoAware variant of VisualObject
 * Base class for any visual object that can be drawn on canvas with memento support
 */
export abstract class MementoAwareVisualObject implements WithMemento {
    protected id: string;
    protected position: TPoint;
    protected size: TSize;
    private _automaticDraw: boolean = true;
    private _onPropertyChanged: MementoAwareObserver<TMementoAwareVisualObjectPropertyChangeArgs>;
    private _zIndex: number = 0;

    get onPropertyChanged(): MementoAwareObserver<TMementoAwareVisualObjectPropertyChangeArgs> {
        return this._onPropertyChanged;
    }

    get zIndex(): number {
        return this._zIndex;
    }

    constructor(id: string, position: TPoint, size: TSize, zIndex: number = 0) {
        this.id = id;
        this.position = position;
        this.size = size;
        this._zIndex = zIndex;
        this._onPropertyChanged = new MementoAwareObserver<TMementoAwareVisualObjectPropertyChangeArgs>(
            `${id}_propertyChanged`
        );
    }

    getId(): string {
        return this.id;
    }

    getObjectTypeName(): string {
        return this.constructor.name;
    }

    /**
     * Subscribe a listener to property change events
     */
    subscribeToPropertyChanges(listener: IMementoAwareListener<TMementoAwareVisualObjectPropertyChangeArgs>): void {
        this._onPropertyChanged.subscribe(listener);
    }

    /**
     * Unsubscribe a listener from property change events
     */
    unsubscribeFromPropertyChanges(listener: IMementoAwareListener<TMementoAwareVisualObjectPropertyChangeArgs>): void {
        this._onPropertyChanged.unsubscribe(listener);
    }

    abstract draw(ctx: CanvasRenderingContext2D): void;

    setZIndex(zIndex: number): void {
        const changed = this._zIndex !== zIndex;
        this._zIndex = zIndex;
        this.redraw(changed, visualObjectProperties.ZIndex);
    }

    getPosition(): TPoint {
        return this.position;
    }

    getSize(): TSize {
        return this.size;
    }

    getAutomaticDraw(): boolean {
        return this._automaticDraw;
    }

    setX(x: number) {
        this.position.x = x;
        this.redraw(true, visualObjectProperties.position);
    }

    setY(y: number) {
        this.position.y = y;
        this.redraw(true, visualObjectProperties.position);
    }

    setW(w: number) {
        this.size.width = w;
        this.redraw(true, visualObjectProperties.Size);
    }

    setH(h: number) {
        this.size.height = h;
        this.redraw(true, visualObjectProperties.Size);
    }

    setPosition(position: TPoint): void {
        let changed = this.position.x !== position.x || this.position.y !== position.y;
        this.position = position;
        this.redraw(changed, visualObjectProperties.position);
    }

    setSize(size: TSize): void {
        let changed = this.size.width !== size.width || this.size.height !== size.height;
        this.size = size;
        this.redraw(changed, visualObjectProperties.Size);
    }

    setAutomaticDraw(automaticDraw: boolean): void {
        this._automaticDraw = automaticDraw;
    }

    /**
     * @param change
     * @param reason why the redraw is called, name of the property that changed,
     * or name of event that triggered the redraw
     */
    protected redraw(change: boolean, reason: string): void {
        if (this._automaticDraw && change) {
            this._onPropertyChanged.notify({
                property: reason,
                VisualObject: this,
            });
        }
    }
}