import { GraphLayoutManager } from "./GraphLayoutManager";
import { NodeVisualObject } from "../Node/NodeVisualObject";
import { Graph } from "../Graph";
import * as d3 from "d3";

interface NodeD3 extends d3.SimulationNodeDatum {
    id: string;
    x: number;
    y: number;
    node: NodeVisualObject;
}

interface EdgeD3 extends d3.SimulationLinkDatum<NodeD3> {
    source: NodeD3;
    target: NodeD3;
}

export class SpringForceLayoutManager implements GraphLayoutManager {
    private width: number;
    private height: number;
    private springLength: number;
    private springConstant: number = 0.2;
    private maxIterations: number = 400;
    private threshold: number = 0.2;

    constructor(width: number, height: number, springLength?: number) {
        this.width = width;
        this.height = height;
        this.springLength = springLength || Math.min(width, height) / 4;
        springLength = this.springLength;
    }

    layout(graph: Graph): void {
        const nodes = graph.getAllNodes();
        const edges = graph.getAllEdges();
        
        if (nodes.length === 0) return;

        // Initialize positions if not set
        this.initializePositions(nodes);

        // Prepare data for d3
        const nodeData: NodeD3[] = nodes.map(node => ({
            id: node.getId(),
            x: node.getRealPosition().x,
            y: node.getRealPosition().y,
            node: node
        }));

        // Create a map of node IDs to node data objects for quick lookup
        const nodeMap = new Map(nodeData.map(n => [n.id, n]));

        const edgeData: EdgeD3[] = edges.map(edge => {
            const source = nodeMap.get(edge.getSource().getId());
            const target = nodeMap.get(edge.getTarget().getId());
            
            if (!source || !target) {
                throw new Error(`Edge references non-existent node: ${edge.getSource().getId()} -> ${edge.getTarget().getId()}`);
            }

            return {
                source,
                target
            };
        });

        // Create d3 force simulation
        const simulation = d3.forceSimulation<NodeD3>(nodeData)
            .force("charge", d3.forceManyBody<NodeD3>().strength(-1000))
            .force("center", d3.forceCenter<NodeD3>(this.width / 2, this.height / 2))
            .force("link", d3.forceLink<NodeD3, EdgeD3>(edgeData)
                .distance(this.springLength)
                .strength(this.springConstant))
            .alphaDecay(0.03);

        // Run simulation
        for (let i = 0; i < this.maxIterations; i++) {
            simulation.tick();
            
            // Update node positions
            nodeData.forEach(d => {
                // Constrain to bounds
                d.x = Math.max(50, Math.min(this.width - 50, d.x));
                d.y = Math.max(50, Math.min(this.height - 50, d.y));
                
                // Update actual node positions
                d.node.setRealPosition({ x: d.x, y: d.y });
            });

            // Check if system has stabilized
            if (simulation.alpha() < this.threshold) {
                break;
            }
        }

        // Final position adjustment to ensure nodes are within bounds
        nodes.forEach(node => {
            const pos = node.getRealPosition();
            const adjustedPos = {
                x: Math.max(50, Math.min(this.width - 50, pos.x)),
                y: Math.max(50, Math.min(this.height - 50, pos.y))
            };
            node.setRealPosition(adjustedPos);
        });
    }

    private initializePositions(nodes: NodeVisualObject[]): void {
        // Start with circular layout if positions aren't set
        nodes.forEach((node, i) => {
            const angle = (2 * Math.PI * i) / nodes.length;
            const radius = this.springLength * 2;
            const x = this.width / 2 + radius * Math.cos(angle);
            const y = this.height / 2 + radius * Math.sin(angle);
            
            if (!node.getRealPosition()) {
                node.setRealPosition({ x, y });
            }
        });
    }
}