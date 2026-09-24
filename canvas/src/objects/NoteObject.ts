import type { TBBox, TColor, TPoint } from '@story/shared';
import { isPointInBBox } from '../geometry/polygon';
import type { TDrawSpec } from '../renderer/types';
import { SceneObject, type TSceneObjectJSON, type TSceneObjectOptions } from '../scene/SceneObject';

/**
 * Free text placed in world space — the README's "draw a river and name it"
 * (VISUALIZER_PLAN §3.2, §4.3 `TMap.notes`).
 *
 * The sizing is the interesting part. A note is **anchored** in world units but **drawn** in
 * screen pixels, so it stays readable at any zoom. That creates one problem the other objects
 * do not have: its bounding box, which selection and hit-testing need, is a function of the
 * current zoom. `setMeasuredScreenSize` is how the box learns its real extent — the renderer
 * knows the text metrics, the object does not.
 *
 * Until it has been measured, the box is estimated from the character count. That estimate is
 * only ever used for one frame (the one before the first measurement), and for the headless
 * tests, where there is no text engine to ask.
 */

export type TNoteObjectOptions = TSceneObjectOptions & {
    position: TPoint;
    text: string;
    color?: TColor;
    /** Screen pixels. */
    fontSize?: number;
    rotation?: number;
    background?: TColor;
    selected?: boolean;
};

export type TNoteObjectJSON = TSceneObjectJSON & {
    position: TPoint;
    text: string;
    color: TColor;
    fontSize: number;
    rotation?: number;
};

/** Rough width of one character as a fraction of the font size, for the pre-measurement guess. */
const CHARACTER_WIDTH_RATIO = 0.55;

export class NoteObject extends SceneObject {
    readonly type = 'note';

    private _position: TPoint;
    private _text: string;
    private _color: TColor;
    private _fontSize: number;
    private _rotation: number;
    private _background?: TColor;
    private _selected: boolean;

    /** Screen-pixel extent of the rendered text, once something has measured it. */
    private measuredScreen: { width: number; height: number } | null = null;

    /**
     * World units per screen pixel at the last draw. Kept so `bounds` can convert the screen
     * measurement back into world units without reaching for the viewport, which this object —
     * like every other `SceneObject` — has no reference to.
     */
    private pixelSize = { width: 1, height: 1 };

    constructor(options: TNoteObjectOptions) {
        super(options);
        this._position = { ...options.position };
        this._text = options.text;
        this._color = options.color ?? '#ffffff';
        this._fontSize = options.fontSize ?? 14;
        this._rotation = options.rotation ?? 0;
        this._background = options.background;
        this._selected = options.selected ?? false;
    }

    get position(): TPoint {
        return this._position;
    }
    set position(value: TPoint) {
        if (value.x === this._position.x && value.y === this._position.y) return;
        this._position = { ...value };
        this.notify('position');
    }

    get text(): string {
        return this._text;
    }
    set text(value: string) {
        if (value === this._text) return;
        this._text = value;
        this.measuredScreen = null;
        this.notify('text');
    }

    get color(): TColor {
        return this._color;
    }
    set color(value: TColor) {
        if (value === this._color) return;
        this._color = value;
        this.notify('color');
    }

    get fontSize(): number {
        return this._fontSize;
    }
    set fontSize(value: number) {
        this._fontSize = value;
        this.measuredScreen = null;
        this.notify('fontSize');
    }

    get rotation(): number {
        return this._rotation;
    }
    set rotation(value: number) {
        this._rotation = value;
        this.notify('rotation');
    }

    get selected(): boolean {
        return this._selected;
    }
    set selected(value: boolean) {
        if (value === this._selected) return;
        this._selected = value;
        this.notify('selected');
    }

    /**
     * Tells the note how big it actually renders. Called by whoever can measure text — the map
     * store, from the renderer — and kept out of `toSpec` so the object stays pure.
     */
    setMeasuredScreenSize(size: { width: number; height: number }): void {
        this.measuredScreen = { ...size };
    }

    /** Tells the note the current zoom, so it can size its world-space box. */
    setPixelSize(pixelSize: { width: number; height: number }): void {
        this.pixelSize = { ...pixelSize };
    }

    /** Screen-pixel extent: measured if anything has measured it, estimated if not. */
    private get screenSize(): { width: number; height: number } {
        if (this.measuredScreen) return this.measuredScreen;
        const lines = this._text.split('\n');
        const longest = lines.reduce((max, line) => Math.max(max, line.length), 0);
        return {
            width: Math.max(1, longest * this._fontSize * CHARACTER_WIDTH_RATIO),
            height: Math.max(1, lines.length * this._fontSize * 1.2),
        };
    }

    /**
     * World-space box, centred on `position`.
     *
     * Rotation is accounted for by taking the *rotated* extent, so a note at 45° is selectable
     * along its whole length rather than only where the unrotated box happens to overlap it.
     */
    get bounds(): TBBox {
        const screen = this.screenSize;
        let width = screen.width * this.pixelSize.width;
        let height = screen.height * this.pixelSize.height;

        if (this._rotation !== 0) {
            const radians = (this._rotation * Math.PI) / 180;
            const cos = Math.abs(Math.cos(radians));
            const sin = Math.abs(Math.sin(radians));
            const rotatedWidth = width * cos + height * sin;
            const rotatedHeight = width * sin + height * cos;
            width = rotatedWidth;
            height = rotatedHeight;
        }

        return {
            min: { x: this._position.x - width / 2, y: this._position.y - height / 2 },
            max: { x: this._position.x + width / 2, y: this._position.y + height / 2 },
        };
    }

    hitTest(world: TPoint, tolerance = 0): boolean {
        if (!this.visible) return false;
        const box = this.bounds;
        return isPointInBBox(world, {
            min: { x: box.min.x - tolerance, y: box.min.y - tolerance },
            max: { x: box.max.x + tolerance, y: box.max.y + tolerance },
        });
    }

    translate(delta: TPoint): void {
        this.position = { x: this._position.x + delta.x, y: this._position.y + delta.y };
    }

    toSpec(): TDrawSpec {
        const children: TDrawSpec[] = [];

        if (this._selected) {
            const box = this.bounds;
            children.push({
                kind: 'rect',
                position: box.min,
                size: { width: box.max.x - box.min.x, height: box.max.y - box.min.y },
                stroke: '#ffffff',
                strokeWidth: 1,
                strokeScaleEnabled: false,
                dash: [4, 4],
            });
        }

        children.push({
            kind: 'text',
            position: this._position,
            text: this._text,
            fontSize: this._fontSize,
            fill: this._color,
            rotation: this._rotation,
            background: this._background,
            centered: true,
            align: 'center',
        });

        return { kind: 'group', children };
    }

    toJSON(): TNoteObjectJSON {
        return {
            ...super.toJSON(),
            position: { ...this._position },
            text: this._text,
            color: this._color,
            fontSize: this._fontSize,
            rotation: this._rotation === 0 ? undefined : this._rotation,
        };
    }

    static fromJSON(json: TNoteObjectJSON): NoteObject {
        const note = new NoteObject({
            id: json.id,
            position: json.position,
            text: json.text,
            color: json.color,
            fontSize: json.fontSize,
            rotation: json.rotation,
        });
        note.applyBaseJSON(json);
        return note;
    }
}
