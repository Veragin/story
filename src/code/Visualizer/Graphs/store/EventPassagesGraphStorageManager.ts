import { CanvasManager } from "../CanvasManager";
import { Graph } from "../Graph";
import { GraphDeserializer } from "./GraphDeserializer";
import { GraphSerializer, SerializedGraph } from "./GraphSerializer";
import { GraphActualizer } from "./GraphActualizer";
import { SpringForceLayoutManager } from "../graphLayouts/SpringForceLayoutManager";


export class EventPassagesGraphStorageManager {
    private static graphs: Map<string, Graph> = new Map();
    private static readonly STORAGE_PREFIX = 'passage-graph-';

    static async getGraph(
        eventId: string,
        canvasManager: CanvasManager,
        canvasWidth: number,
        canvasHeight: number
    ): Promise<Graph> {
        // Check if graph is in memory
        const inMemoryGraph = this.graphs.get(eventId);
        if (inMemoryGraph) {
            // add to canvas manager
            for (const node of inMemoryGraph.getAllNodes()) {
                canvasManager.addObject(node);
            }
            for (const edge of inMemoryGraph.getAllEdges()) {
                canvasManager.addObject(edge);
            }
            return inMemoryGraph;
        }

        // Try to load from localStorage
        const storedGraph = this.loadGraphFromStorage(eventId, canvasManager);
        if (storedGraph) {
            // Verify and update stored graph data using GraphActualizer
            const verifiedGraph = await GraphActualizer.verifyGraphData(
                eventId,
                storedGraph,
                canvasManager,
                canvasWidth,
                canvasHeight
            );
            this.setupGraphAutoSave(eventId, storedGraph);
            this.graphs.set(eventId, storedGraph);
            return storedGraph;
        }

        // Create new empty graph and let GraphActualizer populate it
        const newGraph = await this.createNewGraph(eventId, canvasManager, canvasWidth, canvasHeight);
        this.setupGraphAutoSave(eventId, newGraph);
        this.graphs.set(eventId, newGraph);
        return newGraph;
    }

    private static setupGraphAutoSave(eventId: string, graph: Graph): void {
        const saveGraphCallback = () => {
            this.saveGraphToStorage(eventId, graph);
        };

        graph.onNodeAdded.subscribe((node) => {
            node.onPropertyChanged.subscribe(saveGraphCallback);
            this.saveGraphToStorage(eventId, graph);
        });

        graph.onNodeRemoved.subscribe((node) => {
            node.onPropertyChanged.unsubscribe(saveGraphCallback);
            this.saveGraphToStorage(eventId, graph);
        });

        graph.onEdgeAdded.subscribe((edge) => {
            edge.onPropertyChanged.subscribe(saveGraphCallback);
            this.saveGraphToStorage(eventId, graph);
        });

        graph.onEdgeRemoved.subscribe((edge) => {
            edge.onPropertyChanged.unsubscribe(saveGraphCallback);
            this.saveGraphToStorage(eventId, graph);
        });

        // Setup initial subscriptions for existing nodes and edges
        const nodes = graph.getAllNodes();
        const edges = graph.getAllEdges();

        // Watch node changes
        nodes.forEach(node => {
            node.onPropertyChanged.subscribe(saveGraphCallback);
        });

        // Watch edge changes
        edges.forEach(edge => {
            edge.onPropertyChanged.subscribe(saveGraphCallback);
        });
    }

    private static saveGraphToStorage(eventId: string, graph: Graph): void {
        try {
            const serializedGraph = GraphSerializer.serialize(graph);
            localStorage.setItem(
                this.STORAGE_PREFIX + eventId,
                JSON.stringify(serializedGraph)
            );
        } catch (error) {
            console.error('Failed to save graph to storage:', error);
        }
    }

    private static loadGraphFromStorage(eventId: string, canvasManager: CanvasManager): Graph | null {
        try {
            const storageKey = this.STORAGE_PREFIX + eventId;
            const serializedData = localStorage.getItem(storageKey);

            if (!serializedData) {
                return null;
            }

            const graphData: SerializedGraph = JSON.parse(serializedData);
            const graph = GraphDeserializer.deserialize(graphData, canvasManager);
            return graph;
        } catch (error) {
            console.error('Failed to load graph from storage:', error);
            return null;
        }
    }

    private static async createNewGraph(
        eventId: string,
        canvasManager: CanvasManager,
        canvasWidth: number,
        canvasHeight: number
    ): Promise<Graph> {
        // Create empty graph with appropriate layout manager
        const graph = new Graph(canvasManager);
        
        try {
            // Let GraphActualizer populate the graph
            const populatedGraph = await GraphActualizer.verifyGraphData(
                eventId,
                graph,
                canvasManager,
                canvasWidth,
                canvasHeight
            );

            graph.setLayoutManager(new SpringForceLayoutManager(
                canvasWidth,
                canvasHeight
            ));
            graph.layout();

            this.saveGraphToStorage(eventId, populatedGraph);
            return populatedGraph;
        } catch (error) {
            console.error('Failed to create new graph:', error);
            throw new Error(`Failed to create graph for event ${eventId}`);
        }
    }

    static clearStorage(eventId?: string): void {
        if (eventId) {
            // Clear specific event graph
            localStorage.removeItem(this.STORAGE_PREFIX + eventId);
            this.graphs.delete(eventId);
        } else {
            // Clear all graphs
            for (const key of Object.keys(localStorage)) {
                if (key.startsWith(this.STORAGE_PREFIX)) {
                    localStorage.removeItem(key);
                }
            }
            this.graphs.clear();
        }
    }
}