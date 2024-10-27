import { CanvasManager } from "./CanvasManager";
import { EdgeVisualObject } from "./EdgeVisualObject";
import { NodeVisualObject } from "./Node/NodeVisualObject";

export interface GraphLayoutManager {
    layout(graph: Graph): void;
}

export class CircularGraphLayoutManager implements GraphLayoutManager {
    private centerX: number;
    private centerY: number;
    private radius: number;

    constructor(centerX: number, centerY: number, radius: number) {
        this.centerX = centerX;
        this.centerY = centerY;
        this.radius = radius;
    }

    layout(graph: Graph): void {
        const nodes = graph.getAllNodes();
        const nodeCount = nodes.length;
        if (nodeCount === 0) return;

        let i = 0;
        for (const node of nodes.values()) {
            const angle = (2 * Math.PI * i) / nodeCount;
            const x = this.centerX + this.radius * Math.cos(angle);
            const y = this.centerY + this.radius * Math.sin(angle);
            
            node.setRealPosition({ x, y });
            i++;
        }
    }
}

export class Graph {
    private canvasManager: CanvasManager;
    private nodes: Map<string, NodeVisualObject> = new Map();
    private edges: Map<string, EdgeVisualObject> = new Map();
    private layoutManager: GraphLayoutManager;
    
    constructor(canvasManager: CanvasManager) {
        this.canvasManager = canvasManager;
        this.layoutManager = new CircularGraphLayoutManager(
            canvasManager.canvas.width / 2,
            canvasManager.canvas.height / 2,
            Math.min(canvasManager.canvas.width, canvasManager.canvas.height) / 3
        );
    }

    /**
     * Adds a node to the graph
     * @returns The created node visual object
     */
    addNode(node: NodeVisualObject, id: string): NodeVisualObject {
        if (this.nodes.has(id)) {
            throw new Error(`Node with id ${id} already exists`);
        }

        this.nodes.set(id, node);
        this.canvasManager.addObject(node);
        return node;
    }

    /**
     * Adds an edge between two nodes
     * @returns The created edge visual object
     */
    addEdge(edge: EdgeVisualObject, id: string): EdgeVisualObject {
        if (this.edges.has(id)) {
            throw new Error(`Edge with id ${id} already exists`);
        }

        this.edges.set(id, edge);
        this.canvasManager.addObject(edge);
        return edge;
    }

    removeNode(id: string): void {
        const node = this.nodes.get(id);
        if (!node) {
            return;
        }

        // Remove all connected edges first
        for (const [edgeId, edge] of this.edges) {
            if (edge.getSource() === node || edge.getTarget() === node) {
                this.removeEdge(edgeId);
            }
        }

        // Remove the node
        this.nodes.delete(id);
        this.canvasManager.removeObject(node);
    }

    removeEdge(id: string): void {
        const edge = this.edges.get(id);
        if (!edge) {
            return;
        }

        this.edges.delete(id);
        this.canvasManager.removeObject(edge);
    }

    getNode(id: string): NodeVisualObject | undefined {
        return this.nodes.get(id);
    }

    getEdge(id: string): EdgeVisualObject | undefined {
        return this.edges.get(id);
    }

    /**
     * Gets all edges connected to a node
     */
    getConnectedEdges(nodeId: string): EdgeVisualObject[] {
        const node = this.nodes.get(nodeId);
        if (!node) {
            return [];
        }

        return Array.from(this.edges.values()).filter(
            edge => edge.getSource() === node || edge.getTarget() === node
        );
    }

    /**
     * Clear the entire graph
     */
    clear(): void {
        this.nodes.clear();
        this.edges.clear();
        this.canvasManager.clear();
    }

    getAllNodes(): NodeVisualObject[] {
        return Array.from(this.nodes.values());
    }

    getAllEdges(): EdgeVisualObject[] {
        return Array.from(this.edges.values());
    }

    getLayoutManager(): GraphLayoutManager {
        return this.layoutManager;
    }

    setLayoutManager(layoutManager: GraphLayoutManager): void {
        this.layoutManager = layoutManager;
    }

    layout(): void {
        this.layoutManager.layout(this);
    }
}