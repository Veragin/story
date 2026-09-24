import type { TBBox, TColor, TPoint } from '@story/shared';
import { bbox } from '../geometry/polygon';
import type { TDrawSpec } from '../renderer/types';
import { SceneObject, type TSceneObjectOptions } from '../scene/SceneObject';

/**
 * The little squares on a polygon's vertices, plus the midpoint dots that insert a new one
 * (VISUALIZER_PLAN §3.2: per-vertex handles "with correct z-order and cursor feedback").
 *
 * The handles are drawn with `screenRadius`, i.e. a fixed **pixel** size at every zoom. This is
 * the property that makes vertex editing usable: a world-sized handle is a speck when zoomed
 * out and swallows the shape when zoomed in, and either way the author cannot grab it. It is
 * also why `VertexEditTool` converts its pick tolerance through the viewport rather than using
 * a world constant.
 *
 * One object draws all the handles rather than one object per vertex: a fifty-vertex coastline
 * would otherwise be fifty scene objects churning on every drag frame.
 */

export type TVertexHandlesOptions = TSceneObjectOptions & {
    color?: TColor;
    activeColor?: TColor;
    /** Screen-pixel radius of a vertex handle. */
    radius?: number;
    /** Draw the smaller midpoint dots that insert a vertex. */
    showMidpoints?: boolean;
};

export class VertexHandlesObject extends SceneObject {
    readonly type = 'vertex-handles';

    private points: TPoint[];
    private activeIndex = -1;
    private readonly color: TColor;
    private readonly activeColor: TColor;
    private readonly radius: number;
    private readonly showMidpoints: boolean;

    constructor(options: TVertexHandlesOptions, points: readonly TPoint[]) {
        super({ layer: 'overlay', selectable: false, draggable: false, ...options });
        this.points = points.map((point) => ({ ...point }));
        this.color = options.color ?? '#ffffff';
        this.activeColor = options.activeColor ?? '#ffc300';
        this.radius = options.radius ?? 5;
        this.showMidpoints = options.showMidpoints ?? true;
    }

    setPoints(points: readonly TPoint[]): void {
        this.points = points.map((point) => ({ ...point }));
        this.notify('points');
    }

    /** Highlights one handle — the one under the cursor or being dragged. */
    setActiveIndex(index: number): void {
        if (index === this.activeIndex) return;
        this.activeIndex = index;
        this.notify('activeIndex');
    }

    get bounds(): TBBox {
        return bbox(this.points);
    }

    /** Handles are picked by the tool's own geometry, not by the scene's hit walk. */
    hitTest(): boolean {
        return false;
    }

    translate(): void {
        /* handles follow their polygon */
    }

    toSpec(): TDrawSpec {
        const children: TDrawSpec[] = [];

        if (this.showMidpoints && this.points.length >= 2) {
            for (let i = 0; i < this.points.length; i++) {
                const a = this.points[i];
                const b = this.points[(i + 1) % this.points.length];
                children.push({
                    kind: 'circle',
                    position: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
                    radius: this.radius * 0.55,
                    screenRadius: true,
                    fill: 'rgba(255,255,255,0.45)',
                    stroke: '#000000',
                    strokeWidth: 1,
                    strokeScaleEnabled: false,
                });
            }
        }

        // Vertices after midpoints, so a vertex always draws over the dot beside it.
        this.points.forEach((point, index) => {
            children.push({
                kind: 'circle',
                position: point,
                radius: this.radius,
                screenRadius: true,
                fill: index === this.activeIndex ? this.activeColor : this.color,
                stroke: '#000000',
                strokeWidth: 1,
                strokeScaleEnabled: false,
            });
        });

        return { kind: 'group', children };
    }
}
