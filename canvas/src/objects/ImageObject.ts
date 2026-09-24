import type { TBBox, TPoint, TSize } from '@story/shared';
import { isPointInBBox } from '../geometry/polygon';
import type { TDrawSpec } from '../renderer/types';
import { SceneObject, type TSceneObjectJSON, type TSceneObjectOptions } from '../scene/SceneObject';

/**
 * A bitmap placed in world space — the map background, a passage's art
 * (VISUALIZER_PLAN §3.2, `TMap.background`).
 *
 * The object holds only a URL; decoding, caching and the redraw when the bytes arrive are the
 * renderer's (`KonvaRenderer.loadImage`). That split is deliberate: an object that owned an
 * `HTMLImageElement` could not be constructed in the `node` half of the test suite, and
 * serialising it would mean deciding what a decoded bitmap is in JSON.
 *
 * Not selectable or draggable by default. A map background that moves when the author is trying
 * to click a location is a bug report, not a feature; a caller that wants to reposition it opts
 * in explicitly.
 */

export type TImageObjectOptions = TSceneObjectOptions & {
    position: TPoint;
    size: TSize;
    /** A URL — anything the browser can put in `img.src`, including a data URI. */
    src: string;
    opacity?: number;
};

export type TImageObjectJSON = TSceneObjectJSON & {
    position: TPoint;
    size: TSize;
    src: string;
    opacity: number;
};

export class ImageObject extends SceneObject {
    readonly type = 'image';

    private _position: TPoint;
    private _size: TSize;
    private _src: string;
    private _opacity: number;

    constructor(options: TImageObjectOptions) {
        super({
            layer: options.layer ?? 'background',
            selectable: options.selectable ?? false,
            draggable: options.draggable ?? false,
            ...options,
        });
        this._position = { ...options.position };
        this._size = { ...options.size };
        this._src = options.src;
        this._opacity = options.opacity ?? 1;
    }

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

    get src(): string {
        return this._src;
    }
    set src(value: string) {
        if (value === this._src) return;
        this._src = value;
        this.notify('src');
    }

    get opacity(): number {
        return this._opacity;
    }
    set opacity(value: number) {
        this._opacity = value;
        this.notify('opacity');
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
        return {
            kind: 'image',
            position: this._position,
            size: this._size,
            src: this._src,
            opacity: this._opacity,
        };
    }

    toJSON(): TImageObjectJSON {
        return {
            ...super.toJSON(),
            position: { ...this._position },
            size: { ...this._size },
            src: this._src,
            opacity: this._opacity,
        };
    }

    static fromJSON(json: TImageObjectJSON): ImageObject {
        const image = new ImageObject({
            id: json.id,
            position: json.position,
            size: json.size,
            src: json.src,
            opacity: json.opacity,
        });
        image.applyBaseJSON(json);
        return image;
    }
}
