import type { TSize } from '@story/shared';
import { CircularLayout } from './CircularLayout';
import type { IGraphLayout, IInitialPositionStrategy, ILayoutGraph, ILayoutNode } from './types';

/**
 * Force-directed layout: nodes repel, edges attract, everything drifts toward the centre, and
 * velocity is damped until it settles. Ported from `SpringForceLayoutManager`.
 *
 * The integrator and every constant are the original's, including the two very different
 * parameter sets it carried — one for the one-shot `layout()` (hot: long springs, high speed
 * cap, strong damping) and one for the per-frame `step()` (cool: short-range repulsion, small
 * forces). The original set those by assigning to the same instance fields at the top of each
 * method, which meant calling one permanently changed the other's behaviour. They are two
 * frozen constant objects now, chosen per call, which is what the code was always trying to say.
 *
 * `pinned` replaces the original's `isDragging()` / `isMounted` `instanceof` checks — see
 * `types.ts`.
 */

type TForce = { dx: number; dy: number };
type TVelocity = { vx: number; vy: number };

type TTuning = {
    attractionK: number;
    repulsionK: number;
    centeringK: number;
    damping: number;
    minMovement: number;
    maxSpeed: number;
    forceScale: number;
    /** Pairs further apart than this exert no repulsion — the O(n²) loop's escape hatch. */
    maxRepulsionDistance: number;
};

/** `layout()`: big moves, long range, allowed to travel far in one pass. */
const BATCH_TUNING: TTuning = {
    attractionK: 0.01,
    repulsionK: 0.01,
    centeringK: 0.001,
    damping: 4,
    minMovement: 1,
    maxSpeed: 15,
    forceScale: 1,
    maxRepulsionDistance: 1000,
};

/** `step()`: small nudges the author can watch without the graph exploding. */
const LIVE_TUNING: TTuning = {
    attractionK: 0.1,
    repulsionK: 50,
    centeringK: 0.2,
    damping: 0.15,
    minMovement: 0.05,
    maxSpeed: 5,
    forceScale: 0.2,
    maxRepulsionDistance: 200,
};

const COOLING = 0.95;
const MIN_TEMPERATURE = 1;
const MAX_ITERATIONS = 100_000;

export class SpringForceLayout implements IGraphLayout {
    private readonly initialPositions: IInitialPositionStrategy;
    private readonly velocities = new Map<string, TVelocity>();
    private temperature = 0;

    constructor(options: { initialPositions?: IInitialPositionStrategy } = {}) {
        this.initialPositions = options.initialPositions ?? new CircularLayout();
    }

    layout(graph: ILayoutGraph, bounds: TSize): void {
        if (graph.nodes.length === 0) return;

        this.initialPositions.initialize(graph, bounds);
        this.resetVelocities(graph);
        this.temperature = 1000;

        let iteration = 0;
        while (iteration++ < MAX_ITERATIONS && this.temperature > MIN_TEMPERATURE) {
            if (!this.iterate(graph, bounds, BATCH_TUNING)) break;
            this.temperature *= COOLING;
            this.clampToBounds(graph, bounds);
        }
    }

    step(graph: ILayoutGraph, bounds: TSize): void {
        if (graph.nodes.length === 0) return;
        this.ensureVelocities(graph);
        this.iterate(graph, bounds, LIVE_TUNING);
        this.clampToBounds(graph, bounds);
    }

    destroy(): void {
        this.velocities.clear();
    }

    private resetVelocities(graph: ILayoutGraph): void {
        this.velocities.clear();
        for (const node of graph.nodes) this.velocities.set(node.id, { vx: 0, vy: 0 });
    }

    /**
     * Adds velocities for new nodes and drops them for departed ones, keeping the momentum of
     * everything that is still there. The original reset every velocity to zero on every frame,
     * which made `damping` meaningless during live layout.
     */
    private ensureVelocities(graph: ILayoutGraph): void {
        const present = new Set<string>();
        for (const node of graph.nodes) {
            present.add(node.id);
            if (!this.velocities.has(node.id)) this.velocities.set(node.id, { vx: 0, vy: 0 });
        }
        for (const id of [...this.velocities.keys()]) {
            if (!present.has(id)) this.velocities.delete(id);
        }
    }

    /** One integration step. False once the graph has stopped moving meaningfully. */
    private iterate(graph: ILayoutGraph, bounds: TSize, tuning: TTuning): boolean {
        const k = Math.sqrt((bounds.width * bounds.height) / 100);
        const forces = this.repulsiveForces(graph, tuning, k);
        this.attractiveForces(graph, forces, tuning, k);
        this.centeringForces(graph, forces, tuning, bounds);
        return this.applyForces(graph, forces, tuning) > MIN_TEMPERATURE;
    }

    private repulsiveForces(graph: ILayoutGraph, tuning: TTuning, k: number): Map<string, TForce> {
        const forces = new Map<string, TForce>();
        for (const node of graph.nodes) forces.set(node.id, { dx: 0, dy: 0 });

        const nodes = graph.nodes;
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const a = nodes[i];
                const b = nodes[j];
                const dx = b.position.x - a.position.x;
                const dy = b.position.y - a.position.y;
                // Floored at 0.1: two nodes at the same point would otherwise divide by zero
                // and be flung to infinity.
                const distance = Math.max(0.1, Math.sqrt(dx * dx + dy * dy));
                if (distance > tuning.maxRepulsionDistance) continue;

                const optimal = optimalDistance(a, b, k);
                const magnitude = (tuning.repulsionK * optimal * optimal) / (distance * distance);
                const fx = (dx / distance) * magnitude;
                const fy = (dy / distance) * magnitude;

                const forceA = forces.get(a.id)!;
                const forceB = forces.get(b.id)!;
                forceA.dx -= fx;
                forceA.dy -= fy;
                forceB.dx += fx;
                forceB.dy += fy;
            }
        }

        for (const [id, force] of forces) forces.set(id, clampForce(force, tuning.maxSpeed));
        return forces;
    }

    private attractiveForces(graph: ILayoutGraph, forces: Map<string, TForce>, tuning: TTuning, k: number): void {
        const byId = new Map(graph.nodes.map((node) => [node.id, node]));
        for (const edge of graph.edges) {
            const source = byId.get(edge.source);
            const target = byId.get(edge.target);
            if (!source || !target) continue;

            const dx = target.position.x - source.position.x;
            const dy = target.position.y - source.position.y;
            const distance = Math.max(0.1, Math.sqrt(dx * dx + dy * dy));

            const magnitude = tuning.attractionK * (distance - optimalDistance(source, target, k));
            const fx = (dx / distance) * magnitude;
            const fy = (dy / distance) * magnitude;

            const sourceForce = forces.get(source.id)!;
            const targetForce = forces.get(target.id)!;
            sourceForce.dx += fx;
            sourceForce.dy += fy;
            targetForce.dx -= fx;
            targetForce.dy -= fy;
        }
    }

    private centeringForces(graph: ILayoutGraph, forces: Map<string, TForce>, tuning: TTuning, bounds: TSize): void {
        const centerX = bounds.width / 2;
        const centerY = bounds.height / 2;

        for (const node of graph.nodes) {
            if (node.pinned) continue;
            const force = forces.get(node.id)!;
            force.dx += (centerX - node.position.x) * tuning.centeringK;
            force.dy += (centerY - node.position.y) * tuning.centeringK;
        }
    }

    /** Integrates force → velocity → position. Returns how far the graph moved this step. */
    private applyForces(graph: ILayoutGraph, forces: Map<string, TForce>, tuning: TTuning): number {
        let totalMovement = 0;

        for (const node of graph.nodes) {
            if (node.pinned) continue;
            const force = forces.get(node.id);
            const velocity = this.velocities.get(node.id);
            if (!force || !velocity) continue;

            velocity.vx = velocity.vx * tuning.damping + force.dx * tuning.forceScale;
            velocity.vy = velocity.vy * tuning.damping + force.dy * tuning.forceScale;

            const speed = Math.sqrt(velocity.vx * velocity.vx + velocity.vy * velocity.vy);
            if (speed > tuning.maxSpeed) {
                const scale = tuning.maxSpeed / speed;
                velocity.vx *= scale;
                velocity.vy *= scale;
            }

            // Below the movement floor the node is parked outright rather than left jittering
            // by a fraction of a pixel forever.
            if (Math.abs(velocity.vx) > tuning.minMovement || Math.abs(velocity.vy) > tuning.minMovement) {
                node.position = { x: node.position.x + velocity.vx, y: node.position.y + velocity.vy };
                totalMovement += Math.sqrt(velocity.vx * velocity.vx + velocity.vy * velocity.vy);
            } else {
                velocity.vx = 0;
                velocity.vy = 0;
            }
        }

        return totalMovement;
    }

    private clampToBounds(graph: ILayoutGraph, bounds: TSize): void {
        for (const node of graph.nodes) {
            if (node.pinned) continue;
            node.position = {
                x: Math.max(-node.size.width / 2, Math.min(bounds.width - node.size.width / 2, node.position.x)),
                y: Math.max(0, Math.min(bounds.height - node.size.height / 2, node.position.y)),
            };
        }
    }
}

/** Rest length between two nodes: the base spring plus both nodes' own extent. */
const optimalDistance = (a: ILayoutNode, b: ILayoutNode, k: number): number => k + averageExtent(a) + averageExtent(b);

const averageExtent = (node: ILayoutNode): number => (node.size.width + node.size.height) / 2;

const clampForce = (force: TForce, maxSpeed: number): TForce => {
    const magnitude = Math.sqrt(force.dx * force.dx + force.dy * force.dy);
    if (magnitude <= 0) return force;
    const scale = Math.min(magnitude, maxSpeed) / magnitude;
    return { dx: force.dx * scale, dy: force.dy * scale };
};
