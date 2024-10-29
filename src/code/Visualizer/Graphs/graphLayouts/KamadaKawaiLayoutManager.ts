import { GraphLayoutManager } from "./GraphLayoutManager";
import { NodeVisualObject } from "../Node/NodeVisualObject";
import { Graph } from "../Graph";
import { EdgeVisualObject } from "../EdgeVisualObject";
import { LeftToRightInitializePositionStrategy } from "./LeftToRightInitializePositionStrategy";

type NodeGradient = {
    dx: number;
    dy: number;
    delta: number;
}


export class KamadaKawaiLayoutManager implements GraphLayoutManager {
    private width: number;
    private height: number;
    private idealEdgeLength: number;                // Ideal edge length between nodes
    private springConstant: number;                // Spring constant
    private epsilon: number = 0.01;    // Threshold for convergence
    private maxIterations: number = 1000;  // Max outer loop iterations
    private innerIterations: number = 10; // Max inner loop iterations for each node
    private initializePositionStrategy: InitializePositionStrategy;
    
    constructor(width: number, height: number, L?: number, K: number = 100) {
        this.width = width;
        this.height = height * 1.5;
        this.idealEdgeLength = L || Math.min(width, height);
        this.idealEdgeLength = this.idealEdgeLength * 1.5;
        this.springConstant = K;
        this.initializePositionStrategy = new LeftToRightInitializePositionStrategy();
    }
    
    private prevEnergy = Infinity;
    private currentEnergy: number = 0;
    private springConstants: number[][] = [];
    private idealLengths: number[][] = [];
    private nodes: NodeVisualObject[] = [];
    layout(graph: Graph): void {
        this.nodes = graph.getAllNodes();
        if (this.nodes.length === 0) return;  // Exit if no nodes are present

        this.initializePositions(this.nodes, graph.getAllEdges());



        // Calculate shortest paths between all pairs of nodes
        const distances = this.calculateAllPairsShortestPaths(graph);

        // Calculate average distance in the graph for normalizing distances
        let avgDistance = 0;
        let count = 0;
        distances.forEach(row => {
            row.forEach(d => {
                if (d !== Infinity && d !== 0) {
                    avgDistance += d;
                    count++;
                }
            });
        });
        avgDistance = count > 0 ? avgDistance / count : 1;

        // Normalize distances by dividing each by the average distance
        const normalizedDistances = distances.map(row =>
            row.map(d => (d === Infinity ? avgDistance * 2 : d / avgDistance))
        );

        // Calculate spring constants and ideal lengths between each pair of nodes
        this.springConstants = [];
        this.idealLengths = [];
        for (let i = 0; i < this.nodes.length; i++) {
            this.springConstants[i] = [];
            this.idealLengths[i] = [];
            for (let j = 0; j < this.nodes.length; j++) {
                if (i !== j) {
                    this.springConstants[i][j] = this.springConstant / (normalizedDistances[i][j] * normalizedDistances[i][j]);
                    this.idealLengths[i][j] = this.idealEdgeLength * normalizedDistances[i][j];
                }
            }
        }

        // Perform layout adjustments by iterating until convergence or max iterations
        let iteration = 0;
        this.prevEnergy = Infinity;
        this.currentEnergy = this.calculateTotalEnergy(this.nodes, this.springConstants, this.idealLengths);

        /*while (iteration++ < this.maxIterations) {
            if(!this.calclateSingleIteration()) 
                break;
        }*/

        // Final adjustments to node positions, ensuring layout fits within boundaries
        this.adjustNodePositions(this.nodes);
    }


    private calculateTotalEnergy(
        nodes: NodeVisualObject[],
        springConstants: number[][],
        idealLengths: number[][]
    ): number {
        let energy = 0;

        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const pos1 = nodes[i].getPosition();
                const pos2 = nodes[j].getPosition();

                const dx = pos1.x - pos2.x;
                const dy = pos1.y - pos2.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance > 0) {
                    const springLength = idealLengths[i][j];
                    const springK = springConstants[i][j];
                    energy += 0.5 * springK * (distance - springLength) * (distance - springLength);
                }
            }
        }

        return energy;
    }

    private calculateNodeGradient(
        nodeIndex: number,
        nodes: NodeVisualObject[],
        springConstants: number[][],
        idealLengths: number[][]
    ): NodeGradient {
        const pos = nodes[nodeIndex].getPosition();
        let gradientX = 0;
        let gradientY = 0;

        for (let j = 0; j < nodes.length; j++) {
            if (j === nodeIndex) continue;

            const posJ = nodes[j].getPosition();
            const dx = pos.x - posJ.x;
            const dy = pos.y - posJ.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < 0.1) continue;

            const factor = springConstants[nodeIndex][j] * (1 - idealLengths[nodeIndex][j] / distance);
            gradientX += factor * dx;
            gradientY += factor * dy;
        }

        const delta = Math.sqrt(gradientX * gradientX + gradientY * gradientY);
        return { dx: gradientX, dy: gradientY, delta };
    }

    private optimizeNodePosition(
        nodeIndex: number,
        nodes: NodeVisualObject[],
        springConstants: number[][],
        idealLengths: number[][],
        gradient: NodeGradient
    ): number {
        const node = nodes[nodeIndex];
        const pos = node.getPosition();

        // Adaptive step size
        const stepSize = 0.5 / (1 + Math.sqrt(gradient.delta));

        const newPos = {
            x: pos.x - stepSize * gradient.dx,
            y: pos.y - stepSize * gradient.dy
        };

        node.setPosition(newPos);

        const newGradient = this.calculateNodeGradient(
            nodeIndex,
            nodes,
            springConstants,
            idealLengths
        );

        return newGradient.delta;
    }

    private calculateAllPairsShortestPaths(graph: Graph): number[][] {
        const nodes = graph.getAllNodes();
        const n = nodes.length;
        const distances: number[][] = Array(n).fill(0).map(() => Array(n).fill(Infinity));

        // Initialize distances
        for (let i = 0; i < n; i++) {
            distances[i][i] = 0;
        }

        // Set direct connections
        const edges = graph.getAllEdges();
        edges.forEach(edge => {
            const sourceIndex = nodes.findIndex(n => n.getId() === edge.getSource().getId());
            const targetIndex = nodes.findIndex(n => n.getId() === edge.getTarget().getId());
            distances[sourceIndex][targetIndex] = 1;
            distances[targetIndex][sourceIndex] = 1;
        });

        // Floyd-Warshall algorithm
        for (let k = 0; k < n; k++) {
            for (let i = 0; i < n; i++) {
                for (let j = 0; j < n; j++) {
                    if (distances[i][k] !== Infinity && distances[k][j] !== Infinity) {
                        distances[i][j] = Math.min(
                            distances[i][j],
                            distances[i][k] + distances[k][j]
                        );
                    }
                }
            }
        }

        return distances;
    }

    private initializePositions(nodes: NodeVisualObject[], edges: EdgeVisualObject[]): void {
        this.initializePositionStrategy.initializePositions(nodes, edges, this.width, this.height);
    }

    private adjustNodePositions(nodes: NodeVisualObject[]): void {
        const padding = Math.min(this.width, this.height) * 0.1;  // Relative padding
        nodes.forEach(node => {
            const pos = node.getPosition();
            const adjustedPos = {
                x: Math.max(padding, Math.min(this.width - padding, pos.x)),
                y: Math.max(padding, Math.min(this.height - padding, pos.y))
            };
            node.setPosition(adjustedPos);
        });
    }

    private calclateSingleIteration(): boolean {
        // Calculate gradients for each node
        const gradients: NodeGradient[] = this.nodes.map((_, i) =>
            this.calculateNodeGradient(i, this.nodes, this.springConstants, this.idealLengths)
        );
    
        // Find the node with the largest gradient delta to optimize its position
        let maxDelta = 0;
        let maxNode = 0;
        gradients.forEach((gradient, index) => {
            if (gradient.delta > maxDelta) {
                maxDelta = gradient.delta;
                maxNode = index;
            }
        });
    
        // Stop if change in energy is below the convergence threshold
        if (Math.abs(this.prevEnergy - this.currentEnergy) < this.epsilon) 
            return false;
    
        // Optimize the position of the node with the largest gradient
        let innerIteration = 0;
        while (innerIteration++ < this.innerIterations) {
            // Re-calculate gradient and adjust position of the node
            const nodeGradient = this.calculateNodeGradient(
                maxNode,
                this.nodes,
                this.springConstants,
                this.idealLengths
            );
            const nodeDelta = this.optimizeNodePosition(
                maxNode,
                this.nodes,
                this.springConstants,
                this.idealLengths,
                nodeGradient
            );
    
            // Exit inner loop if position change is below a small threshold
            if (nodeDelta < this.epsilon / 10) 
                break;
        }
    
        // Update energy values
        this.prevEnergy = this.currentEnergy;
        this.currentEnergy = this.calculateTotalEnergy(this.nodes, this.springConstants, this.idealLengths);
        return true;
    }

    performSingleIteration(): void {
        this.calclateSingleIteration();
        this.adjustNodePositions(this.nodes);
    }
}

export interface InitializePositionStrategy {
    initializePositions(
        nodes: NodeVisualObject[],
        edges: EdgeVisualObject[],
        width: number,
        height: number): void;
}

export class CircularInitializePositionStrategy implements InitializePositionStrategy {
    initializePositions(
        nodes: NodeVisualObject[],
        edges: EdgeVisualObject[],
        width: number,
        height: number): void {

        void edges;
        nodes.forEach((node, i) => {
            const angle = (2 * Math.PI * i) / nodes.length;
            const radius = Math.min(width, height) / 3;
            const x = width / 2 + radius * Math.cos(angle);
            const y = height / 2 + radius * Math.sin(angle);
            node.setPosition({ x, y });
        });
    }
}


