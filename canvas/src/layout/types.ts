import type { TPoint, TSize } from '@story/shared';

/**
 * The structural interface every layout algorithm in this folder works against.
 *
 * ## Why this file exists at all
 *
 * VISUALIZER_PLAN §3.2 says `layout/` is "moved verbatim from `Graphs/graphLayouts/**`". It is
 * not, quite, and could not be: the originals take a `Graph`, which owns a `CanvasManager`, and
 * reach into `NodeVisualObject`, `EdgeVisualObject`, `DraggableVisualObject` and
 * `PassageNodeVisualObject`. Every one of those is Visualizer code, and §3.1 says this package
 * imports `@story/shared` and nothing else internal.
 *
 * So the *algorithms* moved verbatim — Floyd–Warshall, the Kamada–Kawai energy model, Tarjan's
 * SCCs, the spring-force integrator, every tuning constant — and only their **surface** changed:
 * they now read `{id, position, size, pinned}` instead of a canvas object. That is a smaller
 * change than it sounds, because position and size were all they ever used.
 *
 * ## `pinned` replaces two `instanceof` checks
 *
 * The spring layout skipped a node when it was `isDragging()` or, for passages, `isMounted`.
 * Those are two names for one idea — *this node's position is not yours to move* — and they
 * were expressed as `instanceof` tests against two unrelated classes, which is why the layout
 * had to import the Visualizer's node types in the first place. One boolean covers both, and
 * the caller decides what makes a node pinned.
 */

export interface ILayoutNode {
    readonly id: string;
    /** Read and written by the layout. World units. */
    position: TPoint;
    readonly size: TSize;
    /**
     * When true the layout reads this node's position but never writes it — the node is being
     * dragged, or the author placed it deliberately and it must stay put.
     */
    readonly pinned?: boolean;
}

export interface ILayoutEdge {
    readonly id: string;
    readonly source: string;
    readonly target: string;
}

/** What a layout is handed: a flat node list, a flat edge list, nothing else. */
export interface ILayoutGraph {
    readonly nodes: readonly ILayoutNode[];
    readonly edges: readonly ILayoutEdge[];
}

export interface IGraphLayout {
    /** Runs to convergence (or to the algorithm's iteration cap) and writes node positions. */
    layout(graph: ILayoutGraph, bounds: TSize): void;
    /**
     * Advances one frame. Used by the live, animated layout the passage graph runs while the
     * author watches; `layout` is the one-shot "tidy this up now" button.
     */
    step(graph: ILayoutGraph, bounds: TSize): void;
    destroy(): void;
}

/** Where a layout starts from before it begins optimising. */
export interface IInitialPositionStrategy {
    initialize(graph: ILayoutGraph, bounds: TSize): void;
}

/** Index nodes by id once, rather than `findIndex` inside a triple loop. */
export const indexById = (nodes: readonly ILayoutNode[]): Map<string, number> => {
    const index = new Map<string, number>();
    nodes.forEach((node, i) => index.set(node.id, i));
    return index;
};

/** Adjacency as id lists, direction preserved. Edges naming unknown nodes are skipped. */
export const buildAdjacency = (graph: ILayoutGraph): Map<string, string[]> => {
    const adjacency = new Map<string, string[]>();
    for (const node of graph.nodes) adjacency.set(node.id, []);
    for (const edge of graph.edges) {
        const list = adjacency.get(edge.source);
        if (list && adjacency.has(edge.target)) list.push(edge.target);
    }
    return adjacency;
};
