import type { TPoint, TSize } from '@story/shared';
import { describe, expect, it } from 'vitest';
import { CircularLayout } from '../src/layout/CircularLayout';
import { KamadaKawaiLayout } from '../src/layout/KamadaKawaiLayout';
import { LeftToRightLayout } from '../src/layout/LeftToRightLayout';
import { SpringForceLayout } from '../src/layout/SpringForceLayout';
import type { ILayoutGraph, ILayoutNode } from '../src/layout/types';

const BOUNDS: TSize = { width: 1000, height: 800 };

class Node implements ILayoutNode {
    position: TPoint = { x: 0, y: 0 };
    constructor(
        readonly id: string,
        readonly size: TSize = { width: 100, height: 40 },
        readonly pinned = false
    ) {}
}

const graphOf = (ids: string[], edges: [string, string][] = []): ILayoutGraph & { nodes: Node[] } => ({
    nodes: ids.map((id) => new Node(id)),
    edges: edges.map(([source, target], i) => ({ id: `e${i}`, source, target })),
});

const distance = (a: TPoint, b: TPoint) => Math.hypot(a.x - b.x, a.y - b.y);

describe('CircularLayout', () => {
    it('spaces nodes evenly on a circle', () => {
        const graph = graphOf(['a', 'b', 'c', 'd']);
        new CircularLayout().layout(graph, BOUNDS);

        const center = { x: BOUNDS.width / 2, y: BOUNDS.height / 2 };
        const radii = graph.nodes.map((node) => distance(node.position, center));
        for (const radius of radii) expect(radius).toBeCloseTo(radii[0], 6);
    });

    it('does nothing to an empty graph', () => {
        expect(() => new CircularLayout().layout(graphOf([]), BOUNDS)).not.toThrow();
    });

    it('leaves pinned nodes where they are', () => {
        const pinned = new Node('pinned', { width: 10, height: 10 }, true);
        pinned.position = { x: 7, y: 9 };
        const graph: ILayoutGraph = { nodes: [pinned, new Node('free')], edges: [] };
        new CircularLayout().layout(graph, BOUNDS);
        expect(pinned.position).toEqual({ x: 7, y: 9 });
    });
});

describe('LeftToRightLayout', () => {
    /** The seeding's whole purpose: an edge should point rightwards, i.e. reading order. */
    it('places a chain left to right', () => {
        const graph = graphOf(
            ['a', 'b', 'c'],
            [
                ['a', 'b'],
                ['b', 'c'],
            ]
        );
        new LeftToRightLayout().initialize(graph, BOUNDS);

        const [a, b, c] = graph.nodes;
        expect(a.position.x).toBeLessThan(b.position.x);
        expect(b.position.x).toBeLessThan(c.position.x);
    });

    /** A cycle is one strongly-connected component and must share a column. */
    it('keeps a cycle in one column', () => {
        const graph = graphOf(
            ['a', 'b', 'c'],
            [
                ['a', 'b'],
                ['b', 'c'],
                ['c', 'a'],
            ]
        );
        new LeftToRightLayout().initialize(graph, BOUNDS);
        const xs = graph.nodes.map((node) => node.position.x);
        const spread = Math.max(...xs) - Math.min(...xs);
        // Within one SCC's own small circle, not a full column gap apart.
        expect(spread).toBeLessThan(300);
    });

    it('centres a single-node component in its cell instead of offsetting it onto a circle of one', () => {
        const graph = graphOf(['only']);
        new LeftToRightLayout().initialize(graph, BOUNDS);

        const node = graph.nodes[0];
        // Its own cell is exactly one node, so the centre is the start offset plus half a node.
        expect(node.position).toEqual({
            x: BOUNDS.width * 0.1 + node.size.width / 2,
            y: BOUNDS.height * 0.1 + node.size.height / 2,
        });
    });

    /**
     * The defect this guards: the SCC circle radius used to be a flat 100-world-unit constant
     * capped at `nodeCount * 20`, so a two-node cycle of 180-wide passage boxes was arranged on
     * a 40-unit circle — two boxes drawn nearly on top of each other.
     */
    it('spaces a cycle so its nodes do not overlap, whatever size they are', () => {
        for (const size of [
            { width: 40, height: 20 },
            { width: 180, height: 64 },
            { width: 600, height: 200 },
        ]) {
            const nodes = ['a', 'b', 'c'].map((id) => new Node(id, size));
            const graph: ILayoutGraph = {
                nodes,
                edges: [
                    { id: 'e1', source: 'a', target: 'b' },
                    { id: 'e2', source: 'b', target: 'c' },
                    { id: 'e3', source: 'c', target: 'a' },
                ],
            };

            new LeftToRightLayout().initialize(graph, BOUNDS);

            for (let i = 0; i < nodes.length; i++) {
                for (let j = i + 1; j < nodes.length; j++) {
                    const dx = Math.abs(nodes[i].position.x - nodes[j].position.x);
                    const dy = Math.abs(nodes[i].position.y - nodes[j].position.y);
                    const separated = dx >= size.width || dy >= size.height;
                    expect(separated, `${size.width}×${size.height}: ${nodes[i].id} overlaps ${nodes[j].id}`).toBe(
                        true
                    );
                }
            }
        }
    });

    it('separates components of a chain by more than a node width', () => {
        const size = { width: 180, height: 64 };
        const nodes = ['a', 'b'].map((id) => new Node(id, size));
        const graph: ILayoutGraph = { nodes, edges: [{ id: 'e', source: 'a', target: 'b' }] };

        new LeftToRightLayout().initialize(graph, BOUNDS);
        expect(nodes[1].position.x - nodes[0].position.x).toBeGreaterThanOrEqual(size.width);
    });

    it('separates disconnected components vertically', () => {
        const graph = graphOf(['a', 'b'], []);
        new LeftToRightLayout().initialize(graph, BOUNDS);
        expect(graph.nodes[0].position.y).not.toBe(graph.nodes[1].position.y);
    });

    /**
     * The original kept Tarjan's state on the instance and never reset it, so a second call
     * returned the first call's components.
     */
    it('gives the same answer when reused', () => {
        const layout = new LeftToRightLayout();
        const first = graphOf(['a', 'b'], [['a', 'b']]);
        layout.initialize(first, BOUNDS);
        const firstPositions = first.nodes.map((node) => ({ ...node.position }));

        const second = graphOf(['a', 'b'], [['a', 'b']]);
        layout.initialize(second, BOUNDS);
        expect(second.nodes.map((node) => node.position)).toEqual(firstPositions);
    });

    /** The reason Tarjan is iterative here: a long chain must not overflow the stack. */
    it('handles a chain long enough to blow a recursive Tarjan', () => {
        const ids = Array.from({ length: 20_000 }, (_, i) => `n${i}`);
        const edges = ids.slice(1).map((id, i) => [ids[i], id] as [string, string]);
        expect(() => new LeftToRightLayout().initialize(graphOf(ids, edges), BOUNDS)).not.toThrow();
    });

    it('leaves nothing at the origin when the graph is disconnected from every root', () => {
        // A pure cycle has no in-degree-zero component; every node must still get a place.
        const graph = graphOf(
            ['a', 'b'],
            [
                ['a', 'b'],
                ['b', 'a'],
            ]
        );
        new LeftToRightLayout().initialize(graph, BOUNDS);
        for (const node of graph.nodes) {
            expect(Number.isFinite(node.position.x)).toBe(true);
            expect(Number.isFinite(node.position.y)).toBe(true);
        }
    });
});

describe('KamadaKawaiLayout', () => {
    it('separates connected nodes', () => {
        const graph = graphOf(['a', 'b'], [['a', 'b']]);
        new KamadaKawaiLayout({ maxIterations: 200 }).layout(graph, BOUNDS);
        expect(distance(graph.nodes[0].position, graph.nodes[1].position)).toBeGreaterThan(0);
    });

    it('leaves every position finite', () => {
        const graph = graphOf(
            ['a', 'b', 'c', 'd', 'e'],
            [
                ['a', 'b'],
                ['b', 'c'],
                ['c', 'd'],
                ['d', 'e'],
                ['e', 'a'],
            ]
        );
        new KamadaKawaiLayout({ maxIterations: 300 }).layout(graph, BOUNDS);
        for (const node of graph.nodes) {
            expect(Number.isFinite(node.position.x)).toBe(true);
            expect(Number.isFinite(node.position.y)).toBe(true);
        }
    });

    /** The original's descent loop was commented out, so `layout()` never optimised anything. */
    it('actually moves nodes from their seeded positions', () => {
        const graph = graphOf(
            ['a', 'b', 'c'],
            [
                ['a', 'b'],
                ['a', 'c'],
            ]
        );
        const layout = new KamadaKawaiLayout({ maxIterations: 300 });
        layout.layout(graph, BOUNDS);
        const optimised = graph.nodes.map((node) => ({ ...node.position }));

        const seedOnly = graphOf(
            ['a', 'b', 'c'],
            [
                ['a', 'b'],
                ['a', 'c'],
            ]
        );
        new LeftToRightLayout().initialize(seedOnly, { width: BOUNDS.width, height: BOUNDS.height * 1.5 });
        const seeded = seedOnly.nodes.map((node) => ({ ...node.position }));

        expect(optimised).not.toEqual(seeded);
    });

    it('respects pinned nodes', () => {
        const pinned = new Node('pinned', { width: 10, height: 10 }, true);
        pinned.position = { x: 500, y: 400 };
        const free = new Node('free');
        const graph: ILayoutGraph = { nodes: [pinned, free], edges: [{ id: 'e', source: 'pinned', target: 'free' }] };

        new KamadaKawaiLayout({ maxIterations: 200 }).layout(graph, BOUNDS);
        expect(pinned.position).toEqual({ x: 500, y: 400 });
    });

    it('does nothing to an empty graph', () => {
        expect(() => new KamadaKawaiLayout().layout(graphOf([]), BOUNDS)).not.toThrow();
    });

    it('ignores an edge naming a node that is not in the graph', () => {
        const graph: ILayoutGraph = {
            nodes: [new Node('a'), new Node('b')],
            edges: [{ id: 'e', source: 'a', target: 'ghost' }],
        };
        expect(() => new KamadaKawaiLayout({ maxIterations: 50 }).layout(graph, BOUNDS)).not.toThrow();
        for (const node of graph.nodes) expect(Number.isFinite(node.position.x)).toBe(true);
    });

    it('steps one frame without running to convergence', () => {
        const graph = graphOf(['a', 'b'], [['a', 'b']]);
        const layout = new KamadaKawaiLayout();
        expect(() => layout.step(graph, BOUNDS)).not.toThrow();
    });
});

describe('SpringForceLayout', () => {
    it('pushes unconnected nodes apart', () => {
        const graph = graphOf(['a', 'b']);
        graph.nodes[0].position = { x: 500, y: 400 };
        graph.nodes[1].position = { x: 501, y: 400 };

        const layout = new SpringForceLayout();
        for (let i = 0; i < 100; i++) layout.step(graph, BOUNDS);

        expect(distance(graph.nodes[0].position, graph.nodes[1].position)).toBeGreaterThan(1);
    });

    it('leaves every position finite after a full layout', () => {
        const graph = graphOf(
            ['a', 'b', 'c', 'd'],
            [
                ['a', 'b'],
                ['b', 'c'],
                ['c', 'd'],
            ]
        );
        new SpringForceLayout().layout(graph, BOUNDS);
        for (const node of graph.nodes) {
            expect(Number.isFinite(node.position.x)).toBe(true);
            expect(Number.isFinite(node.position.y)).toBe(true);
        }
    });

    it('never moves a pinned node', () => {
        const pinned = new Node('pinned', { width: 10, height: 10 }, true);
        pinned.position = { x: 123, y: 456 };
        const graph: ILayoutGraph = {
            nodes: [pinned, new Node('free')],
            edges: [{ id: 'e', source: 'pinned', target: 'free' }],
        };

        const layout = new SpringForceLayout();
        layout.layout(graph, BOUNDS);
        for (let i = 0; i < 50; i++) layout.step(graph, BOUNDS);

        expect(pinned.position).toEqual({ x: 123, y: 456 });
    });

    /**
     * The original assigned its tuning to instance fields at the top of each method, so calling
     * `layout()` permanently changed how `step()` behaved and vice versa.
     */
    it('keeps the batch and live tunings independent', () => {
        const build = () => {
            const graph = graphOf(['a', 'b'], [['a', 'b']]);
            graph.nodes[0].position = { x: 100, y: 100 };
            graph.nodes[1].position = { x: 140, y: 100 };
            return graph;
        };

        const clean = build();
        const cleanLayout = new SpringForceLayout();
        cleanLayout.step(clean, BOUNDS);
        const cleanPositions = clean.nodes.map((node) => ({ ...node.position }));

        const dirty = build();
        const dirtyLayout = new SpringForceLayout();
        dirtyLayout.layout(graphOf(['x', 'y'], [['x', 'y']]), BOUNDS);
        dirtyLayout.step(dirty, BOUNDS);

        expect(dirty.nodes.map((node) => node.position)).toEqual(cleanPositions);
    });

    it('drops velocities for nodes that leave the graph', () => {
        const layout = new SpringForceLayout();
        const graph = graphOf(['a', 'b']);
        layout.step(graph, BOUNDS);

        const smaller: ILayoutGraph = { nodes: [graph.nodes[0]], edges: [] };
        expect(() => layout.step(smaller, BOUNDS)).not.toThrow();
    });

    it('survives two nodes at exactly the same point', () => {
        const graph = graphOf(['a', 'b']);
        graph.nodes[0].position = { x: 300, y: 300 };
        graph.nodes[1].position = { x: 300, y: 300 };

        const layout = new SpringForceLayout();
        for (let i = 0; i < 20; i++) layout.step(graph, BOUNDS);
        for (const node of graph.nodes) expect(Number.isFinite(node.position.x)).toBe(true);
    });

    it('does nothing to an empty graph', () => {
        expect(() => new SpringForceLayout().layout(graphOf([]), BOUNDS)).not.toThrow();
        expect(() => new SpringForceLayout().step(graphOf([]), BOUNDS)).not.toThrow();
    });
});
