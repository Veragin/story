import { GraphLayoutManager } from "./GraphLayoutManager";
import { NodeVisualObject } from "../Node/NodeVisualObject";
import { Graph } from "../Graph";
import { EdgeVisualObject } from "../EdgeVisualObject";
import { LeftToRightInitializePositionStrategy } from "./LeftToRightInitializePositionStrategy";
import { DraggableVisualObject } from "../Node/DraggableVisualObject";
import { InitializePositionStrategy } from "./KamadaKawaiLayoutManager";

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
    private initializePositionStrategy: InitializePositionStrategy;
    private nodes: NodeVisualObject[] = [];
    
    // Physics parameters
    private nodeVelocities: Map<string, NodeVelocity> = new Map();
    private friction: number = 0.95;        // Slightly increased friction
    private velocityDecay: number = 0.8;    // Reduced decay for smoother movement
    private minMovement: number = 0.0001;    // Smaller minimum movement threshold
    private maxSpeed: number = 5;           // Reduced maximum speed for smoother animation
    private forceScale: number = 0.15;      // Reduced force scale for smaller steps
    private previousForces: Map<string, Force> = new Map(); // Track previous forces

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
            this.previousForces.set(node.getId(), { dx: 0, dy: 0 });
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
            // Normalize and scale the force
            return {
                dx: (force.dx / magnitude) * Math.min(magnitude, this.maxSpeed),
                dy: (force.dy / magnitude) * Math.min(magnitude, this.maxSpeed)
            };
        }
        return force;
    }

    private isForceConsistent(nodeId: string, currentForce: Force): boolean {
        const prevForce = this.previousForces.get(nodeId);
        if (!prevForce) return true;

        // Check if forces are rapidly changing direction
        const dotProduct = (currentForce.dx * prevForce.dx + currentForce.dy * prevForce.dy);
        const currentMagnitude = Math.sqrt(currentForce.dx * currentForce.dx + currentForce.dy * currentForce.dy);
        const prevMagnitude = Math.sqrt(prevForce.dx * prevForce.dx + prevForce.dy * prevForce.dy);
        
        if (currentMagnitude < this.minMovement && prevMagnitude < this.minMovement) {
            return true; // Forces are very small, consider it consistent
        }

        // Calculate the cosine of the angle between forces
        const cosAngle = dotProduct / (currentMagnitude * prevMagnitude || 1);
        return cosAngle > -0.5; // Allow some direction change but prevent complete reversals
    }

    private getOptimalDistance(source: NodeVisualObject, target: NodeVisualObject): number {
        // Base optimal distance
        const baseDistance = this.k;
        
        // Add the sizes of both nodes to the optimal distance
        const sourceSize = this.getNodeSize(source);
        const targetSize = this.getNodeSize(target);
        
        // Return base distance plus the radii of both nodes
        return baseDistance + sourceSize + targetSize;
    }

    private calculateRepulsiveForces(): Map<string, Force> {
        const forces = new Map<string, Force>();
        
        // Initialize forces for all nodes
        this.nodes.forEach(node => {
            forces.set(node.getId(), { dx: 0, dy: 0 });
        });

        // Calculate repulsive forces between all pairs of nodes
        for (let i = 0; i < this.nodes.length; i++) {
            for (let j = i + 1; j < this.nodes.length; j++) {
                const node1 = this.nodes[i];
                const node2 = this.nodes[j];
                const pos1 = node1.getRealPosition();
                const pos2 = node2.getRealPosition();

                // Calculate distance and direction
                const dx = pos2.x - pos1.x;
                const dy = pos2.y - pos1.y;
                const distance = Math.max(0.1, Math.sqrt(dx * dx + dy * dy));

                // Get optimal distance considering node sizes
                const optimalDistance = this.getOptimalDistance(node1, node2);

                // Calculate repulsive force using optimal distance
                const force = this.repulsionK * optimalDistance * optimalDistance / (distance * distance);
                const forceX = (dx / distance) * force;
                const forceY = (dy / distance) * force;

                // Get existing forces
                const force1 = forces.get(node1.getId())!;
                const force2 = forces.get(node2.getId())!;
                
                // Update forces
                force1.dx -= forceX;
                force1.dy -= forceY;
                force2.dx += forceX;
                force2.dy += forceY;
            }
        }

        // Normalize all forces
        forces.forEach((force, nodeId) => {
            const normalizedForce = this.normalizeForce(force);
            forces.set(nodeId, normalizedForce);
        });

        return forces;
    }

    private calculateAttractiveForces(graph: Graph, forces: Map<string, Force>): void {
        // Calculate attractive forces along edges
        graph.getAllEdges().forEach(edge => {
            const source = edge.getSource();
            const target = edge.getTarget();
            const pos1 = source.getRealPosition();
            const pos2 = target.getRealPosition();

            // Calculate distance and direction
            const dx = pos2.x - pos1.x;
            const dy = pos2.y - pos1.y;
            const distance = Math.max(0.1, Math.sqrt(dx * dx + dy * dy));

            // Get optimal distance considering node sizes
            const optimalDistance = this.getOptimalDistance(source, target);

            // Calculate attractive force based on difference from optimal distance
            const force = this.attractionK * (distance - optimalDistance);
            const forceX = (dx / distance) * force;
            const forceY = (dy / distance) * force;

            // Apply forces to both nodes
            const force1 = forces.get(source.getId())!;
            const force2 = forces.get(target.getId())!;
            
            force1.dx += forceX;
            force1.dy += forceY;
            force2.dx -= forceX;
            force2.dy -= forceY;
        });
    }

    private applyForces(forces: Map<string, Force>): number {
        let totalMovement = 0;

        this.nodes.forEach(node => {
            const nodeId = node.getId();
            if (node instanceof DraggableVisualObject && (node as DraggableVisualObject).isDragging()) {
                this.nodeVelocities.set(nodeId, { vx: 0, vy: 0 });
                return;
            }

            const force = forces.get(nodeId)!;
            
            // Check for force consistency
            if (!this.isForceConsistent(nodeId, force)) {
                // If forces are inconsistent, dampen them more heavily
                force.dx *= 0.5;
                force.dy *= 0.5;
            }

            const velocity = this.nodeVelocities.get(nodeId)!;
            const pos = node.getRealPosition();

            // Update velocity with dampening for rapid changes
            velocity.vx = velocity.vx * this.friction + (force.dx * this.forceScale);
            velocity.vy = velocity.vy * this.friction + (force.dy * this.forceScale);

            // Additional dampening for node 0 or nodes with erratic behavior
            if (nodeId === "0" || Math.abs(velocity.vx) + Math.abs(velocity.vy) > this.maxSpeed * 2) {
                velocity.vx *= 0.7;
                velocity.vy *= 0.7;
            }

            // Smooth decay
            velocity.vx *= this.velocityDecay;
            velocity.vy *= this.velocityDecay;

            // Stop very small movements
            if (Math.abs(velocity.vx) < this.minMovement) velocity.vx = 0;
            if (Math.abs(velocity.vy) < this.minMovement) velocity.vy = 0;

            // Update position
            const newPos = {
                x: pos.x + velocity.vx,
                y: pos.y + velocity.vy
            };

            node.setRealPosition(newPos);
            totalMovement += Math.sqrt(velocity.vx * velocity.vx + velocity.vy * velocity.vy);

            // Store current force for next iteration
            this.previousForces.set(nodeId, force);
        });

        return totalMovement;
    }


    private initializePositions(nodes: NodeVisualObject[], edges: EdgeVisualObject[]): void {
        this.initializePositionStrategy.initializePositions(nodes, edges, this.width, this.height);
    }

    private adjustNodePositions(): void {
        const padding = Math.min(this.width, this.height) * 0.1;

        this.nodes.forEach(node => {
            if (node instanceof DraggableVisualObject) {
                const draggable = node as DraggableVisualObject;
                if (draggable.isDragging()) {
                    return;
                }

            }
            const pos = node.getRealPosition();
            const adjustedPos = {
                x: Math.max(padding, Math.min(this.width - padding, pos.x)),
                y: Math.max(padding, Math.min(this.height - padding, pos.y))
            };
            node.setRealPosition(adjustedPos);
        });
    }

    private calculateSingleIteration(graph: Graph): boolean {
        // Calculate repulsive forces between all nodes
        const forces = this.calculateRepulsiveForces();

        // Calculate attractive forces along edges
        this.calculateAttractiveForces(graph, forces);

        // Apply forces and get total movement
        const totalMovement = this.applyForces(forces);

        // Return whether we should continue (significant movement occurred)
        return totalMovement > this.minTemp;
    }

    performSingleIteration(graph: Graph): void {
        if (this.temperature <= this.minTemp) {
            this.temperature = this.minTemp;
        }

        // Only perform update if there's significant movement
        let hasMovement = false;
        this.nodeVelocities.forEach(velocity => {
            if (Math.abs(velocity.vx) > this.minMovement || Math.abs(velocity.vy) > this.minMovement) {
                hasMovement = true;
            }
        });

        if (hasMovement) {
            this.calculateSingleIteration(graph);
            this.adjustNodePositions();
            this.temperature *= this.cooling;
        }
    }
}