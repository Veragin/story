import type { TSize } from '@story/shared';
import type { IGraphLayout, IInitialPositionStrategy, ILayoutGraph } from './types';

/**
 * Nodes evenly around one circle. Ported from `CircularGraphLayoutManager`.
 *
 * The original took an explicit centre and radius in its constructor; here both default to the
 * bounds it is handed, because every call site passed the canvas centre and a third of its
 * smaller side anyway. Pass them to override.
 */
export class CircularLayout implements IGraphLayout, IInitialPositionStrategy {
    constructor(private readonly options: { centerX?: number; centerY?: number; radius?: number } = {}) {}

    layout(graph: ILayoutGraph, bounds: TSize): void {
        this.initialize(graph, bounds);
    }

    /** Circular layout converges instantly, so a step is a full layout. */
    step(graph: ILayoutGraph, bounds: TSize): void {
        this.initialize(graph, bounds);
    }

    initialize(graph: ILayoutGraph, bounds: TSize): void {
        const count = graph.nodes.length;
        if (count === 0) return;

        const centerX = this.options.centerX ?? bounds.width / 2;
        const centerY = this.options.centerY ?? bounds.height / 2;
        const radius = this.options.radius ?? Math.min(bounds.width, bounds.height) / 3;

        graph.nodes.forEach((node, i) => {
            if (node.pinned) return;
            const angle = (2 * Math.PI * i) / count;
            node.position = {
                x: centerX + radius * Math.cos(angle),
                y: centerY + radius * Math.sin(angle),
            };
        });
    }

    destroy(): void {
        // Nothing to clean up.
    }
}
