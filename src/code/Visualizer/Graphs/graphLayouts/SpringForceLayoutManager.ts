import { GraphLayoutManager } from "./GraphLayoutManager";
import { NodeVisualObject } from "../Node/NodeVisualObject";
import { Graph } from "../Graph";
import { EdgeVisualObject } from "../EdgeVisualObject";
import { LeftToRightInitializePositionStrategy } from "./LeftToRightInitializePositionStrategy";
import { DraggableVisualObject } from "../Node/DraggableVisualObject";
import { InitializePositionStrategy } from "./KamadaKawaiLayoutManager";
import { PassageNodeVisualObject } from "../PassagesGraph/PassageNodeVisualObject";

interface Force {
    dx: number;
    dy: number;
}

interface NodeVelocity {
    vx: number;
    vy: number;
}

export class SpringForceLayoutManager implements GraphLayoutManager {
    private width: number;
    private height: number;
    private k: number;
    private temperature: number;
    private initialTemp: number;
    private minTemp: number = 1;
    private cooling: number = 0.95;
    private maxIterations: number = 1000;
    private attractionK: number = 0.1;
    private repulsionK: number = 50;
    private centeringK: number = 0.2;
    private initializePositionStrategy: InitializePositionStrategy;
    private nodes: NodeVisualObject[] = [];

    // Physics parameters
    private nodeVelocities: Map<string, NodeVelocity> = new Map();
    private minMovement: number = 0.05;
    private maxSpeed: number = 5;
    private forceScale: number = 0.2;
    private damping: number = 0.15;

    constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
        this.k = Math.sqrt((width * height) / 100);
        this.initialTemp = width / 10;
        this.temperature = this.initialTemp;
        this.initializePositionStrategy = new LeftToRightInitializePositionStrategy();
    }

    private initializeVelocities(): void {
        this.nodes.forEach(node => {
            this.nodeVelocities.set(node.getId(), { vx: 0, vy: 0 });
        });
    }

    layout(graph: Graph): void {
        this.nodes = graph.getAllNodes();
        if (this.nodes.length === 0) return;

        this.initializePositions(this.nodes, graph.getAllEdges());
        this.initializeVelocities();

        let iteration = 0;
        while (iteration++ < this.maxIterations && this.temperature > this.minTemp) {
            if (!this.calculateSingleIteration(graph)) {
                break;
            }
            this.temperature *= this.cooling;
            this.adjustNodePositions();
        }
    }

    private getNodeSize(node: NodeVisualObject): number {
        return (node.getSize().width + node.getSize().height) / 2;
    }

    private normalizeForce(force: Force): Force {
        const magnitude = Math.sqrt(force.dx * force.dx + force.dy * force.dy);
        if (magnitude > 0) {
            return {
                dx: (force.dx / magnitude) * Math.min(magnitude, this.maxSpeed),
                dy: (force.dy / magnitude) * Math.min(magnitude, this.maxSpeed)
            };
        }
        return force;
    }

    private getOptimalDistance(source: NodeVisualObject, target: NodeVisualObject): number {
        const baseDistance = this.k;
        const sourceSize = this.getNodeSize(source);
        const targetSize = this.getNodeSize(target);
        return baseDistance + sourceSize + targetSize;
    }

    private readonly MAX_REPULSION_DISTANCE = 200;

    private calculateRepulsiveForces(): Map<string, Force> {
        const forces = new Map<string, Force>();

        this.nodes.forEach(node => {
            forces.set(node.getId(), { dx: 0, dy: 0 });
        });

        for (let i = 0; i < this.nodes.length; i++) {
            for (let j = i + 1; j < this.nodes.length; j++) {
                const node1 = this.nodes[i];
                const node2 = this.nodes[j];
                const pos1 = node1.getPosition();
                const pos2 = node2.getPosition();

                const dx = pos2.x - pos1.x;
                const dy = pos2.y - pos1.y;
                const distance = Math.max(0.1, Math.sqrt(dx * dx + dy * dy));

                if (distance > this.MAX_REPULSION_DISTANCE) {
                    continue;
                }

                const optimalDistance = this.getOptimalDistance(node1, node2);
                const force = this.repulsionK * optimalDistance * optimalDistance / (distance * distance);
                const forceX = (dx / distance) * force;
                const forceY = (dy / distance) * force;

                const force1 = forces.get(node1.getId())!;
                const force2 = forces.get(node2.getId())!;

                force1.dx -= forceX;
                force1.dy -= forceY;
                force2.dx += forceX;
                force2.dy += forceY;
            }
        }

        forces.forEach((force, nodeId) => {
            const normalizedForce = this.normalizeForce(force);
            forces.set(nodeId, normalizedForce);
        });

        return forces;
    }

    private calculateAttractiveForces(graph: Graph, forces: Map<string, Force>): void {
        graph.getAllEdges().forEach(edge => {
            const source = edge.getSource();
            const target = edge.getTarget();
            const pos1 = source.getPosition();
            const pos2 = target.getPosition();

            const dx = pos2.x - pos1.x;
            const dy = pos2.y - pos1.y;
            const distance = Math.max(0.1, Math.sqrt(dx * dx + dy * dy));

            const optimalDistance = this.getOptimalDistance(source, target);
            const force = this.attractionK * (distance - optimalDistance);
            const forceX = (dx / distance) * force;
            const forceY = (dy / distance) * force;

            const force1 = forces.get(source.getId())!;
            const force2 = forces.get(target.getId())!;

            force1.dx += forceX;
            force1.dy += forceY;
            force2.dx -= forceX;
            force2.dy -= forceY;
        });
    }

    private calculateCenteringForces(forces: Map<string, Force>): void {
        const centerX = this.width / 2;
        const centerY = this.height / 2;

        this.nodes.forEach(node => {
            // Skip mounted or dragging nodes
            if (node instanceof PassageNodeVisualObject && (node as PassageNodeVisualObject).isMounted) {
                return;
            }
            if (node instanceof DraggableVisualObject && (node as DraggableVisualObject).isDragging()) {
                return;
            }

            const pos = node.getPosition();
            const force = forces.get(node.getId())!;
            
            // Calculate distance from center
            const dx = centerX - pos.x;
            const dy = centerY - pos.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance > 0) {
                // Add centering force proportional to distance from center
                force.dx += dx * this.centeringK;
                force.dy += dy * this.centeringK;
            }
        });
    }

    private applyForces(forces: Map<string, Force>): number {
        let totalMovement = 0;

        this.nodes.forEach(node => {
            const nodeId = node.getId();

            if (node instanceof PassageNodeVisualObject) {
                const passageNode = node as PassageNodeVisualObject;
                if (passageNode.isMounted) return;
            }
            if (node instanceof DraggableVisualObject && (node as DraggableVisualObject).isDragging()) {
                return;
            }

            const force = forces.get(nodeId)!;
            const velocity = this.nodeVelocities.get(nodeId)!;
            const pos = node.getPosition();

            velocity.vx *= this.damping;
            velocity.vy *= this.damping;

            velocity.vx += force.dx * this.forceScale;
            velocity.vy += force.dy * this.forceScale;

            const speed = Math.sqrt(velocity.vx * velocity.vx + velocity.vy * velocity.vy);
            if (speed > this.maxSpeed) {
                const scale = this.maxSpeed / speed;
                velocity.vx *= scale;
                velocity.vy *= scale;
            }

            if (Math.abs(velocity.vx) > this.minMovement || Math.abs(velocity.vy) > this.minMovement) {
                const newPos = {
                    x: pos.x + velocity.vx,
                    y: pos.y + velocity.vy
                };
                node.setPosition(newPos);
                totalMovement += Math.sqrt(velocity.vx * velocity.vx + velocity.vy * velocity.vy);
            } else {
                velocity.vx = 0;
                velocity.vy = 0;
            }
        });

        return totalMovement;
    }

    private initializePositions(nodes: NodeVisualObject[], edges: EdgeVisualObject[]): void {
        this.initializePositionStrategy.initializePositions(nodes, edges, this.width, this.height);
    }

    private adjustNodePositions(): void {
        this.nodes.forEach(node => {
            if (node instanceof DraggableVisualObject && (node as DraggableVisualObject).isDragging()) {
                return;
            }

            if (node instanceof PassageNodeVisualObject && (node as PassageNodeVisualObject).isMounted) {
                return;
            }

            const pos = node.getPosition();
            const size = node.getSize();

            const x = Math.max(-size.width / 2, Math.min(this.width - size.width / 2, pos.x));
            const y = Math.max(0, Math.min(this.height - size.height / 2, pos.y));
            node.setPosition({ x, y });
        });
    }

    private calculateSingleIteration(graph: Graph): boolean {
        const forces = this.calculateRepulsiveForces();
        this.calculateAttractiveForces(graph, forces);
        this.calculateCenteringForces(forces);
        const totalMovement = this.applyForces(forces);
        return totalMovement > this.minTemp;
    }

    performSingleIteration(graph: Graph): void {
        if (this.temperature <= this.minTemp) {
            this.temperature = this.minTemp;
        }

        const forces = this.calculateRepulsiveForces();
        this.calculateAttractiveForces(graph, forces);
        this.applyForces(forces);
        this.adjustNodePositions();
    }

    destroy(): void {
        // Nothing to destroy
    }
}