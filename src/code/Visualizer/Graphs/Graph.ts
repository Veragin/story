import { CanvasManager } from './CanvasManager';
import { EdgeVisualObject } from './EdgeVisualObject';
import { GraphLayoutManager } from './graphLayouts/GraphLayoutManager';
import { NodeVisualObject } from './Node/NodeVisualObject';
import { Observer } from 'code/utils/Observer';
import { SpringForceLayoutManager } from './graphLayouts/SpringForceLayoutManager';

export class Graph {
    private nodes: Map<string, NodeVisualObject> = new Map();
    private edges: Map<string, EdgeVisualObject> = new Map();
    readonly onNodeAdded = new Observer<NodeVisualObject>();
    readonly onNodeRemoved = new Observer<NodeVisualObject>();
    readonly onEdgeAdded = new Observer<EdgeVisualObject>();
    readonly onEdgeRemoved = new Observer<EdgeVisualObject>();

    private layoutManager: GraphLayoutManager;

    constructor(public canvasManager: CanvasManager) {
        this.layoutManager = new SpringForceLayoutManager(
            canvasManager.canvas.width / 2,
            canvasManager.canvas.height / 2
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
        this.canvasManager.addObject(node.getContent());

        this.onNodeAdded.notify(node);

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

        this.onEdgeAdded.notify(edge);

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
        this.canvasManager.removeObject(node.getContent());

        this.onNodeRemoved.notify(node);
    }

    removeEdge(id: string): void {
        const edge = this.edges.get(id);
        if (!edge) {
            return;
        }

        this.edges.delete(id);
        this.canvasManager.removeObject(edge);

        this.onEdgeRemoved.notify(edge);
    }

    getNode(id: string): NodeVisualObject | undefined {
        console.log(this.nodes);
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

        return Array.from(this.edges.values()).filter((edge) => edge.getSource() === node || edge.getTarget() === node);
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
