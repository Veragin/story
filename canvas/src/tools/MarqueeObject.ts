import type { TBBox, TPoint } from '@story/shared';
import { bboxFromCorners } from '../geometry/polygon';
import type { TDrawSpec } from '../renderer/types';
import { SceneObject, type TSceneObjectOptions } from '../scene/SceneObject';

/**
 * The rubber-band rectangle `SelectTool` drags over empty space.
 *
 * Tool furniture, not content: it lives on the `overlay` layer, is never selectable, and is
 * removed the moment the gesture ends. It is a `SceneObject` rather than something the renderer
 * draws specially so that tools have exactly one way to put pixels on screen.
 */
export class MarqueeObject extends SceneObject {
    readonly type = 'marquee';

    private origin: TPoint;
    private corner: TPoint;

    constructor(options: TSceneObjectOptions, origin: TPoint) {
        super({ layer: 'overlay', selectable: false, draggable: false, ...options });
        this.origin = { ...origin };
        this.corner = { ...origin };
    }

    setCorners(origin: TPoint, corner: TPoint): void {
        this.origin = { ...origin };
        this.corner = { ...corner };
        this.notify('corners');
    }

    get bounds(): TBBox {
        return bboxFromCorners(this.origin, this.corner);
    }

    /** Never a hit target — clicking the marquee is clicking through it. */
    hitTest(): boolean {
        return false;
    }

    translate(): void {
        /* the marquee is anchored to the gesture, not draggable */
    }

    toSpec(): TDrawSpec {
        const box = this.bounds;
        return {
            kind: 'rect',
            position: box.min,
            size: { width: box.max.x - box.min.x, height: box.max.y - box.min.y },
            fill: 'rgba(120, 170, 255, 0.15)',
            stroke: '#78aaff',
            strokeWidth: 1,
            strokeScaleEnabled: false,
            dash: [4, 4],
        };
    }
}
