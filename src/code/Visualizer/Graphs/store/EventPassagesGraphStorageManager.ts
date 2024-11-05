import { register } from "data/register";
import { CanvasManager } from "../CanvasManager";
import { Graph } from "../Graph";
import { PassageGraphCreator } from "../PassagesGraph/PassageGraphCreator";
import { GraphDeserializer } from "./GraphDeserializer";
import { GraphSerializer, SerializedGraph } from "./GraphSerializer";
import { GraphActualizer } from "./GraphActualizer";


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
            // Verify stored graph data matches current passages
            const verifiedGraph = await GraphActualizer.verifyGraphData(eventId, storedGraph, canvasManager);
            this.setupGraphAutoSave(eventId, storedGraph);
            this.graphs.set(eventId, storedGraph);
            return storedGraph;
        }


        // Create new graph if not found in storage
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
        const graphCreator = new PassageGraphCreator(
            canvasManager,
            canvasWidth,
            canvasHeight
        );

        // Get passages for the event
        const passages = await register.passages[eventId as keyof typeof register.passages]();
        const graph = await graphCreator.createGraph(passages.default);

        this.saveGraphToStorage(eventId, graph);

        return graph;
    }

    private static async verifyGraphData(eventId: string, graph: Graph): Promise<Graph> {
        // TODO: Implement verification logic that checks if the stored graph structure
        // matches the current passage structure in the register:
        // 1. Load current passages from register
        // 2. Compare nodes and edges with current passages
        // 3. Add missing nodes/edges
        // 4. Remove obsolete nodes/edges
        // 5. Return updated graph

        // For now, just return the original graph
        return graph;
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