import type { TSize } from '@story/shared';
import { LeftToRightLayout } from './LeftToRightLayout';
import {
    indexById,
    type IGraphLayout,
    type IInitialPositionStrategy,
    type ILayoutGraph,
    type ILayoutNode,
} from './types';

/**
 * Kamada–Kawai: treat every pair of nodes as a spring whose rest length is their graph-theoretic
 * distance, then descend the resulting energy. Ported from `KamadaKawaiLayoutManager`.
 *
 * The model, the Floyd–Warshall all-pairs distances, the average-distance normalisation, the
 * adaptive step size and the tuning constants are the original's. What changed:
 *
 *  - It reads `ILayoutNode` rather than `NodeVisualObject` (see `types.ts`).
 *  - `layout()` **runs the descent**. The original's main loop was commented out, so `layout()`
 *    seeded positions, built the spring tables, computed the energy once and then only clamped
 *    everything into bounds — every edge length it had just computed went unused. The loop is
 *    restored and bounded by `maxIterations`.
 *  - Node ids are indexed into a `Map` once instead of `findIndex` inside the triple loop, which
 *    took the shortest-path setup from O(E·N) to O(E).
 */

type TGradient = { dx: number; dy: number; delta: number };

export type TKamadaKawaiOptions = {
    /** Rest length of an edge at graph-distance 1. Defaults to the smaller bound × 1.5. */
    idealEdgeLength?: number;
    /** Overall spring stiffness. */
    springConstant?: number;
    /** Energy change below which the descent is called converged. */
    epsilon?: number;
    /** Cap on outer iterations, so a pathological graph still terminates. */
    maxIterations?: number;
    /** Where nodes start. Defaults to the left-to-right SCC seeding. */
    initialPositions?: IInitialPositionStrategy;
};

export class KamadaKawaiLayout implements IGraphLayout {
    private readonly springConstant: number;
    private readonly epsilon: number;
    private readonly maxIterations: number;
    private readonly innerIterations = 10;
    private readonly explicitIdealEdgeLength?: number;
    private readonly initialPositions: IInitialPositionStrategy;

    private idealEdgeLength = 0;
    private springConstants: number[][] = [];
    private idealLengths: number[][] = [];
    private nodes: ILayoutNode[] = [];
    private previousEnergy = Infinity;
    private currentEnergy = 0;

    constructor(options: TKamadaKawaiOptions = {}) {
        this.explicitIdealEdgeLength = options.idealEdgeLength;
        this.springConstant = options.springConstant ?? 100;
        this.epsilon = options.epsilon ?? 0.01;
        this.maxIterations = options.maxIterations ?? 500;
        this.initialPositions = options.initialPositions ?? new LeftToRightLayout();
    }

    layout(graph: ILayoutGraph, bounds: TSize): void {
        if (!this.prepare(graph, bounds)) return;

        let iteration = 0;
        while (iteration++ < this.maxIterations) {
            if (!this.iterate()) break;
        }

        this.clampToBounds(bounds);
    }

    step(graph: ILayoutGraph, bounds: TSize): void {
        // `prepare` is cheap relative to a frame and keeps `step` correct when the caller adds
        // or removes a node between frames — which the passage graph does as passages load.
        if (!this.prepare(graph, bounds)) return;
        this.iterate();
        this.clampToBounds(bounds);
    }

    destroy(): void {
        this.nodes = [];
        this.springConstants = [];
        this.idealLengths = [];
    }

    /** Seeds positions and builds the per-pair spring tables. False when there is nothing to do. */
    private prepare(graph: ILayoutGraph, bounds: TSize): boolean {
        this.nodes = [...graph.nodes];
        if (this.nodes.length === 0) return false;

        // The original stretched the vertical extent by 1.5; a passage graph is wider than it
        // is tall and the seeding needs the room.
        const height = bounds.height * 1.5;
        this.idealEdgeLength = (this.explicitIdealEdgeLength ?? Math.min(bounds.width, bounds.height)) * 1.5;

        this.initialPositions.initialize(graph, { width: bounds.width, height });

        const distances = this.allPairsShortestPaths(graph);

        let total = 0;
        let count = 0;
        for (const row of distances) {
            for (const d of row) {
                if (d !== Infinity && d !== 0) {
                    total += d;
                    count++;
                }
            }
        }
        const averageDistance = count > 0 ? total / count : 1;

        // Disconnected pairs are pushed to twice the average rather than to infinity, which
        // would make their spring constant zero and let components drift apart forever.
        const normalized = distances.map((row) =>
            row.map((d) => (d === Infinity ? averageDistance * 2 : d / averageDistance))
        );

        const n = this.nodes.length;
        this.springConstants = Array.from({ length: n }, () => new Array<number>(n).fill(0));
        this.idealLengths = Array.from({ length: n }, () => new Array<number>(n).fill(0));
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                if (i === j) continue;
                const d = normalized[i][j];
                this.springConstants[i][j] = this.springConstant / (d * d);
                this.idealLengths[i][j] = this.idealEdgeLength * d;
            }
        }

        this.previousEnergy = Infinity;
        this.currentEnergy = this.totalEnergy();
        return true;
    }

    /** One outer step: move the worst node, then re-measure. False once converged. */
    private iterate(): boolean {
        if (Math.abs(this.previousEnergy - this.currentEnergy) < this.epsilon) return false;

        let maxDelta = 0;
        let worst = -1;
        for (let i = 0; i < this.nodes.length; i++) {
            if (this.nodes[i].pinned) continue;
            const delta = this.gradient(i).delta;
            if (delta > maxDelta) {
                maxDelta = delta;
                worst = i;
            }
        }
        if (worst === -1) return false;

        let inner = 0;
        while (inner++ < this.innerIterations) {
            const delta = this.optimize(worst);
            if (delta < this.epsilon / 10) break;
        }

        this.previousEnergy = this.currentEnergy;
        this.currentEnergy = this.totalEnergy();
        return true;
    }

    private totalEnergy(): number {
        let energy = 0;
        for (let i = 0; i < this.nodes.length; i++) {
            for (let j = i + 1; j < this.nodes.length; j++) {
                const a = this.nodes[i].position;
                const b = this.nodes[j].position;
                const dx = a.x - b.x;
                const dy = a.y - b.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance <= 0) continue;
                const rest = this.idealLengths[i][j];
                const k = this.springConstants[i][j];
                energy += 0.5 * k * (distance - rest) * (distance - rest);
            }
        }
        return energy;
    }

    private gradient(nodeIndex: number): TGradient {
        const position = this.nodes[nodeIndex].position;
        let dx = 0;
        let dy = 0;

        for (let j = 0; j < this.nodes.length; j++) {
            if (j === nodeIndex) continue;
            const other = this.nodes[j].position;
            const ox = position.x - other.x;
            const oy = position.y - other.y;
            const distance = Math.sqrt(ox * ox + oy * oy);
            // Coincident nodes have no direction to push in; skipping avoids a 0/0.
            if (distance < 0.1) continue;

            const factor = this.springConstants[nodeIndex][j] * (1 - this.idealLengths[nodeIndex][j] / distance);
            dx += factor * ox;
            dy += factor * oy;
        }

        return { dx, dy, delta: Math.sqrt(dx * dx + dy * dy) };
    }

    /** Moves one node down its gradient and reports the residual. */
    private optimize(nodeIndex: number): number {
        const node = this.nodes[nodeIndex];
        if (node.pinned) return 0;

        const gradient = this.gradient(nodeIndex);
        // Adaptive: a steep gradient takes a proportionally smaller step, so the descent does
        // not overshoot on the first move and oscillate.
        const stepSize = 0.5 / (1 + Math.sqrt(gradient.delta));
        node.position = {
            x: node.position.x - stepSize * gradient.dx,
            y: node.position.y - stepSize * gradient.dy,
        };
        return this.gradient(nodeIndex).delta;
    }

    /** Floyd–Warshall over the undirected graph. Edge weight 1, unreachable is `Infinity`. */
    private allPairsShortestPaths(graph: ILayoutGraph): number[][] {
        const n = this.nodes.length;
        const index = indexById(this.nodes);
        const distances = Array.from({ length: n }, () => new Array<number>(n).fill(Infinity));
        for (let i = 0; i < n; i++) distances[i][i] = 0;

        for (const edge of graph.edges) {
            const from = index.get(edge.source);
            const to = index.get(edge.target);
            // An edge naming a node that is not in the list is skipped, not written at [-1].
            if (from === undefined || to === undefined) continue;
            distances[from][to] = 1;
            distances[to][from] = 1;
        }

        for (let k = 0; k < n; k++) {
            for (let i = 0; i < n; i++) {
                if (distances[i][k] === Infinity) continue;
                for (let j = 0; j < n; j++) {
                    if (distances[k][j] === Infinity) continue;
                    const through = distances[i][k] + distances[k][j];
                    if (through < distances[i][j]) distances[i][j] = through;
                }
            }
        }

        return distances;
    }

    private clampToBounds(bounds: TSize): void {
        const height = bounds.height * 1.5;
        const padding = Math.min(bounds.width, height) * 0.1;
        for (const node of this.nodes) {
            if (node.pinned) continue;
            node.position = {
                x: Math.max(padding, Math.min(bounds.width - padding, node.position.x)),
                y: Math.max(padding, Math.min(height - padding, node.position.y)),
            };
        }
    }
}
