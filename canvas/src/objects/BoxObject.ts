import type { TBBox, TColor, TPoint, TSize } from '@story/shared';
import { isPointInBBox } from '../geometry/polygon';
import type { TDrawSpec } from '../renderer/types';
import { SceneObject, type TSceneObjectJSON, type TSceneObjectOptions } from '../scene/SceneObject';

/**
 * A rounded rectangle with a title and optional body text — the passage node in the chapter
 * view, the chapter node on the timeline (VISUALIZER_PLAN §3.2).
 *
 * Text is drawn in **screen** pixels and the box in **world** units, which is the combination
 * the old engine could not produce: its `TextContent` scaled with the world, so a chapter title
 * became either unreadable or enormous depending on the zoom. Here the box grows and the label
 * stays legible, which is what makes a hundred-passage graph navigable.
 */

export type TBoxObjectOptions = TSceneObjectOptions & {
    position: TPoint;
    size: TSize;
    title?: string;
    subtitle?: string;
    color?: TColor;
    textColor?: TColor;
    borderColor?: TColor;
    borderWidth?: number;
    cornerRadius?: number;
    selected?: boolean;
    /** Drawn with a brighter border. Set by `SelectTool` on pointer-over. */
    hovered?: boolean;
};

export type TBoxObjectJSON = TSceneObjectJSON & {
    position: TPoint;
    size: TSize;
    title?: string;
    subtitle?: string;
    color: TColor;
    borderColor?: TColor;
};

const DEFAULT_COLOR = '#26344a';
const SELECTED_BORDER = '#ffffff';
const HOVER_BORDER = '#9ecbff';

export class BoxObject extends SceneObject {
    readonly type = 'box';

    private _position: TPoint;
    private _size: TSize;
    private _title?: string;
    private _subtitle?: string;
    private _color: TColor;
    private _textColor: TColor;
    private _borderColor?: TColor;
    private _borderWidth: number;
    private _cornerRadius: number;
    private _selected: boolean;
    private _hovered: boolean;

    constructor(options: TBoxObjectOptions) {
        super(options);
        this._position = { ...options.position };
        this._size = { ...options.size };
        this._title = options.title;
        this._subtitle = options.subtitle;
        this._color = options.color ?? DEFAULT_COLOR;
        this._textColor = options.textColor ?? '#ffffff';
        this._borderColor = options.borderColor;
        this._borderWidth = options.borderWidth ?? 1;
        this._cornerRadius = options.cornerRadius ?? 6;
        this._selected = options.selected ?? false;
        this._hovered = options.hovered ?? false;
    }

    /** Top-left corner, in world units. */
    get position(): TPoint {
        return this._position;
    }
    set position(value: TPoint) {
        if (value.x === this._position.x && value.y === this._position.y) return;
        this._position = { ...value };
        this.notify('position');
    }

    get size(): TSize {
        return this._size;
    }
    set size(value: TSize) {
        this._size = { ...value };
        this.notify('size');
    }

    /** Centre, which is what edges anchor to and what `centerOn` wants. */
    get center(): TPoint {
        return { x: this._position.x + this._size.width / 2, y: this._position.y + this._size.height / 2 };
    }

    get title(): string | undefined {
        return this._title;
    }
    set title(value: string | undefined) {
        this._title = value;
        this.notify('title');
    }

    get subtitle(): string | undefined {
        return this._subtitle;
    }
    set subtitle(value: string | undefined) {
        this._subtitle = value;
        this.notify('subtitle');
    }

    get color(): TColor {
        return this._color;
    }
    set color(value: TColor) {
        if (value === this._color) return;
        this._color = value;
        this.notify('color');
    }

    get borderColor(): TColor | undefined {
        return this._borderColor;
    }
    set borderColor(value: TColor | undefined) {
        this._borderColor = value;
        this.notify('borderColor');
    }

    get selected(): boolean {
        return this._selected;
    }
    set selected(value: boolean) {
        if (value === this._selected) return;
        this._selected = value;
        this.notify('selected');
    }

    get hovered(): boolean {
        return this._hovered;
    }
    set hovered(value: boolean) {
        if (value === this._hovered) return;
        this._hovered = value;
        this.notify('hovered');
    }

    get bounds(): TBBox {
        return {
            min: { ...this._position },
            max: { x: this._position.x + this._size.width, y: this._position.y + this._size.height },
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
        const border = this._selected ? SELECTED_BORDER : this._hovered ? HOVER_BORDER : this._borderColor;

        const children: TDrawSpec[] = [
            {
                kind: 'rect',
                position: this._position,
                size: this._size,
                fill: this._color,
                stroke: border,
                strokeWidth: this._selected ? this._borderWidth + 1 : this._borderWidth,
                strokeScaleEnabled: false,
                cornerRadius: this._cornerRadius,
            },
        ];

        if (this._title) {
            children.push({
                kind: 'text',
                // Nudged above centre when there is a subtitle, so the pair reads as a block
                // rather than the title sitting on top of the subtitle.
                position: {
                    x: this.center.x,
                    y: this._subtitle ? this.center.y - this._size.height * 0.12 : this.center.y,
                },
                text: this._title,
                fontSize: 13,
                fontStyle: 'bold',
                fill: this._textColor,
                centered: true,
                align: 'center',
            });
        }

        if (this._subtitle) {
            children.push({
                kind: 'text',
                position: { x: this.center.x, y: this.center.y + this._size.height * 0.18 },
                text: this._subtitle,
                fontSize: 11,
                fill: this._textColor,
                opacity: 0.75,
                centered: true,
                align: 'center',
            });
        }

        return { kind: 'group', children };
    }

    toJSON(): TBoxObjectJSON {
        return {
            ...super.toJSON(),
            position: { ...this._position },
            size: { ...this._size },
            title: this._title,
            subtitle: this._subtitle,
            color: this._color,
            borderColor: this._borderColor,
        };
    }

    static fromJSON(json: TBoxObjectJSON): BoxObject {
        const box = new BoxObject({
            id: json.id,
            position: json.position,
            size: json.size,
            title: json.title,
            subtitle: json.subtitle,
            color: json.color,
            borderColor: json.borderColor,
        });
        box.applyBaseJSON(json);
        return box;
    }
}
