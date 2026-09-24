import type { TSize } from '@story/shared';
import { buildAdjacency, type IInitialPositionStrategy, type ILayoutGraph, type ILayoutNode } from './types';

/**
 * Seeds positions left-to-right by strongly-connected component. Ported from
 * `LeftToRightInitializePositionStrategy`.
 *
 * Tarjan's algorithm finds the SCCs, the condensation is levelled by longest path from a root,
 * each level becomes a column, and each SCC's nodes are arranged in a small circle within its
 * cell. For a passage graph — which is mostly a DAG with the occasional loop back to a hub
 * passage — that produces something close to reading order before the force layout ever runs,
 * which is the whole reason it exists: a spring layout seeded at random converges to a
 * different picture every time the author opens the chapter.
 *
 * Two fixes made during the port, both of them latent bugs rather than changes of behaviour:
 *
 *  - **Tarjan is iterative here.** The original recursed once per node. A chapter is small
 *    today, but the failure mode of a recursive Tarjan is a stack overflow on the author's
 *    biggest chapter, which is exactly when they would least want one.
 *  - **The instance is reusable.** The original kept `index`, `lowLink`, `sccList` and the
 *    visited set as instance fields and never reset them, so calling it twice returned the
 *    first run's components. They are locals now.
 */

/**
 * Spacing, in world units, **added to the nodes' own extent** rather than used as the whole gap.
 *
 * The originals were flat constants (300 / 200 / a 100-unit circle radius) tuned against
 * whatever node size the graph that shipped them happened to use. Applied to a 180×64 passage
 * box they overlap: a two-node cycle becomes one component laid out on a 40-unit circle, i.e.
 * two boxes drawn nearly on top of each other. Measuring from the nodes keeps the layout
 * readable whatever a caller's nodes are.
 */
const HORIZONTAL_GAP = 120;
const VERTICAL_GAP = 80;
/** Smallest circle an SCC is arranged on, before the nodes' own size is taken into account. */
const MIN_SCC_RADIUS = 60;

export class LeftToRightLayout implements IInitialPositionStrategy {
    initialize(graph: ILayoutGraph, bounds: TSize): void {
        if (graph.nodes.length === 0) return;

        const adjacency = buildAdjacency(graph);
        const byId = new Map(graph.nodes.map((node) => [node.id, node]));
        const components = findStronglyConnectedComponents(graph, adjacency);

        // Which component each node belongs to, so condensation edges are a lookup not a scan.
        const componentOf = new Map<string, number>();
        components.forEach((component, i) => {
            for (const id of component) componentOf.set(id, i);
        });

        // Condensation: edges between distinct components, plus each component's in-degree.
        const outgoing = components.map(() => new Set<number>());
        const inDegree = components.map(() => 0);
        for (const edge of graph.edges) {
            const from = componentOf.get(edge.source);
            const to = componentOf.get(edge.target);
            if (from === undefined || to === undefined || from === to) continue;
            if (!outgoing[from].has(to)) {
                outgoing[from].add(to);
                inDegree[to] += 1;
            }
        }

        const levels = assignLevels(components.length, outgoing, inDegree);

        // Group components by level, then lay each level out as a column.
        const byLevel = new Map<number, number[]>();
        levels.forEach((level, component) => {
            const list = byLevel.get(level);
            if (list) list.push(component);
            else byLevel.set(level, [component]);
        });

        const startX = bounds.width * 0.1;
        const startY = bounds.height * 0.1;

        // Column and row pitch come from the widest and tallest node in the graph, so two
        // components never collide however big the caller's nodes are.
        const widest = Math.max(1, ...graph.nodes.map((node) => node.size.width));
        const tallest = Math.max(1, ...graph.nodes.map((node) => node.size.height));
        const columnPitch = widest + HORIZONTAL_GAP;

        let x = startX;
        for (const [, componentsInLevel] of [...byLevel].sort((a, b) => a[0] - b[0])) {
            let y = startY;
            let widestInColumn = widest;

            for (const componentIndex of componentsInLevel) {
                const nodes = [...components[componentIndex]]
                    .map((id) => byId.get(id))
                    .filter((node): node is ILayoutNode => node !== undefined);

                const radius = circleRadius(nodes);
                // The cell's own extent: a one-node component is just the node, a cycle is the
                // circle its nodes sit on plus one node's worth of overhang.
                const cellHeight = nodes.length <= 1 ? tallest : radius * 2 + tallest;
                const cellWidth = nodes.length <= 1 ? widest : radius * 2 + widest;

                positionInCircle(nodes, x + cellWidth / 2, y + cellHeight / 2, radius);

                y += cellHeight + VERTICAL_GAP;
                widestInColumn = Math.max(widestInColumn, cellWidth);
            }

            x += Math.max(columnPitch, widestInColumn + HORIZONTAL_GAP);
        }
    }
}

/**
 * Radius that keeps neighbouring nodes on the circle from overlapping.
 *
 * Two adjacent nodes on a circle of `n` are `2r·sin(π/n)` apart, so requiring that chord to
 * exceed the widest node plus a gap gives the radius directly. Without this a cycle of two
 * 180-wide boxes was laid out on a 40-unit circle.
 */
const circleRadius = (nodes: readonly ILayoutNode[]): number => {
    if (nodes.length <= 1) return 0;
    const widest = Math.max(1, ...nodes.map((node) => Math.max(node.size.width, node.size.height)));
    const needed = (widest + VERTICAL_GAP) / (2 * Math.sin(Math.PI / nodes.length));
    return Math.max(MIN_SCC_RADIUS, needed);
};

const positionInCircle = (nodes: ILayoutNode[], centerX: number, centerY: number, radius: number): void => {
    // One node in a component is the common case — a plain DAG — and it belongs at the centre,
    // not offset by a radius onto a circle of one.
    if (nodes.length === 1) {
        if (!nodes[0].pinned) nodes[0].position = { x: centerX, y: centerY };
        return;
    }
    nodes.forEach((node, i) => {
        if (node.pinned) return;
        const angle = (2 * Math.PI * i) / nodes.length;
        node.position = { x: centerX + radius * Math.cos(angle), y: centerY + radius * Math.sin(angle) };
    });
};

/**
 * Longest-path levelling over the condensation. A component sits one column right of its
 * deepest predecessor, so an edge never points backwards.
 *
 * Components with no root reachable to them (a cycle of components, which a condensation cannot
 * actually contain, or a subgraph whose roots were all pruned) still get a level: anything left
 * unvisited is seeded at 0 in a second pass, rather than dropped off the canvas at `undefined`.
 */
const assignLevels = (count: number, outgoing: Set<number>[], inDegree: number[]): number[] => {
    const levels = new Array<number>(count).fill(-1);

    const walk = (start: number): void => {
        const queue: [number, number][] = [[start, 0]];
        while (queue.length > 0) {
            const [component, level] = queue.pop()!;
            if (levels[component] >= level) continue;
            levels[component] = level;
            for (const next of outgoing[component]) queue.push([next, level + 1]);
        }
    };

    for (let i = 0; i < count; i++) {
        if (inDegree[i] === 0) walk(i);
    }
    for (let i = 0; i < count; i++) {
        if (levels[i] === -1) walk(i);
    }
    return levels;
};

/**
 * Tarjan's strongly-connected components, iterative.
 *
 * Returns components in reverse topological order, which is Tarjan's natural output and is why
 * the levelling above does not care about the order it gets them in.
 */
const findStronglyConnectedComponents = (graph: ILayoutGraph, adjacency: Map<string, string[]>): Set<string>[] => {
    const index = new Map<string, number>();
    const lowLink = new Map<string, number>();
    const onStack = new Set<string>();
    const stack: string[] = [];
    const components: Set<string>[] = [];
    let counter = 0;

    for (const root of graph.nodes) {
        if (index.has(root.id)) continue;

        // Explicit DFS stack: each frame is a node plus how many of its neighbours are done.
        const frames: { node: string; next: number }[] = [{ node: root.id, next: 0 }];
        index.set(root.id, counter);
        lowLink.set(root.id, counter);
        counter += 1;
        stack.push(root.id);
        onStack.add(root.id);

        while (frames.length > 0) {
            const frame = frames[frames.length - 1];
            const neighbours = adjacency.get(frame.node) ?? [];

            if (frame.next < neighbours.length) {
                const neighbour = neighbours[frame.next++];
                if (!index.has(neighbour)) {
                    index.set(neighbour, counter);
                    lowLink.set(neighbour, counter);
                    counter += 1;
                    stack.push(neighbour);
                    onStack.add(neighbour);
                    frames.push({ node: neighbour, next: 0 });
                } else if (onStack.has(neighbour)) {
                    lowLink.set(frame.node, Math.min(lowLink.get(frame.node)!, index.get(neighbour)!));
                }
                continue;
            }

            // Frame exhausted: fold its low-link into its parent, then close a root.
            frames.pop();
            const parent = frames[frames.length - 1];
            if (parent) {
                lowLink.set(parent.node, Math.min(lowLink.get(parent.node)!, lowLink.get(frame.node)!));
            }

            if (lowLink.get(frame.node) === index.get(frame.node)) {
                const component = new Set<string>();
                let popped: string;
                do {
                    popped = stack.pop()!;
                    onStack.delete(popped);
                    component.add(popped);
                } while (popped !== frame.node);
                components.push(component);
            }
        }
    }

    return components;
};
