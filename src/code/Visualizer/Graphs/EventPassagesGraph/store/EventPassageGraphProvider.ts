import { CanvasManager } from '../../CanvasManager';
import { Graph } from '../../Graph';
import { GraphDeserializer } from './GraphDeserializer';
import { GraphSerializer, SerializedGraph } from './GraphSerializer';
import { GraphActualizer } from '../actualizer/GraphActualizer';
import { SpringForceLayoutManager } from '../../graphLayouts/SpringForceLayoutManager';
import { Store } from 'code/Visualizer/stores/Store';
import { createPassageModalContent } from 'code/Visualizer/Events/createPassageModalContent';
import { EventPassagesGraphStorageManager } from './EventPassagesGraphStorageManager';
import { PassageNodeVisualObject } from '../PassageNodeVisualObject';
import { register, TRegisterPassageId } from 'data/register';
import { worldStateCopy } from '../../PassagesGraph/WorldStateCopy';
import { PassageResolver } from './PassageResolver';
import { e } from 'worldState';

export class GraphProvider {
    private static readonly STORAGE_PREFIX = 'passage-graph-';
    private static graphActualizer: GraphActualizer = new GraphActualizer();

    static async getGraph(eventId: string, canvasManager: CanvasManager, store: Store): Promise<Graph> {
        // First check if graph exists in memory
        const inMemoryGraph = EventPassagesGraphStorageManager.getInMemoryGraph(eventId);
        if (inMemoryGraph) {
            // Graph is already set up, just add to canvas manager
            this.addGraphToCanvasManager(inMemoryGraph, canvasManager);
            return inMemoryGraph;
        }

        const canvasWidth = canvasManager.getWidth() ?? 0;
        const canvasHeight = canvasManager.getHeight() ?? 0;

        // Try to load from localStorage
        const storedGraph = this.loadGraphFromStorage(eventId, canvasManager);
        if (storedGraph) {
            // Verify and update stored graph data using GraphActualizer
            await this.graphActualizer.actualizeGraphData(eventId, storedGraph);

            // Setup the graph since it came from storage
            this.setupGraph(eventId, storedGraph, store);

            // Store in memory for next time
            EventPassagesGraphStorageManager.storeInMemory(eventId, storedGraph);

            return storedGraph;
        }

        // Create new empty graph and let GraphActualizer populate it
        const newGraph = await this.createNewGraph(eventId, canvasManager, canvasWidth, canvasHeight);

        this.setupGraph(eventId, newGraph, store);

        // Store in memory and localStorage
        EventPassagesGraphStorageManager.storeInMemory(eventId, newGraph);
        this.saveGraphToStorage(eventId, newGraph);

        return newGraph;
    }

    private static addGraphToCanvasManager(graph: Graph, canvasManager: CanvasManager): void {
        // Add all nodes and edges to canvas manager
        for (const node of graph.getAllNodes()) {
            canvasManager.addObject(node);
        }
        for (const edge of graph.getAllEdges()) {
            canvasManager.addObject(edge);
        }
    }

    private static setupGraph(eventId: string, graph: Graph, store: Store): void {
        this.setupGraphAutoSave(eventId, graph);
        this.setupToolsWindow(eventId, graph, store);
    }

    private static async setupToolsWindow(eventId: string, graph: Graph, store: Store): Promise<void> {
        // Validate eventId is a valid passage key
        if (!(eventId in register.passages)) {
            console.error(`Event '${eventId}' not found in register.passages`);
            return;
        }

        const typedEventId = eventId as TRegisterPassageId;

        // Preload all passages for this event
        await PassageResolver.preloadEventPassages(typedEventId);

        for (const node of graph.getAllNodes()) {
            if (node instanceof PassageNodeVisualObject) {
                const passageNodeRef = node as PassageNodeVisualObject;

                passageNodeRef.onClick.subscribe(async () => {
                    const passage = await PassageResolver.getPassage(
                        typedEventId,
                        passageNodeRef.passageId,
                        worldStateCopy,
                        e
                    );
                    store.setModalContent(createPassageModalContent(passage));
                });

            }
        }
    }

    private static setupGraphAutoSave(eventId: string, graph: Graph): void {
        const saveGraphCallback = () => {
            this.saveGraphToStorage(eventId, graph);
        };

        // Subscribe to graph structure changes
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
        nodes.forEach((node) => {
            node.onPropertyChanged.subscribe(saveGraphCallback);
        });

        // Watch edge changes
        edges.forEach((edge) => {
            edge.onPropertyChanged.subscribe(saveGraphCallback);
        });
    }

    private static saveGraphToStorage(eventId: string, graph: Graph): void {
        EventPassagesGraphStorageManager.saveToStorage(eventId, graph);
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
            const populatedGraph = await this.graphActualizer.actualizeGraphData(eventId, graph);

            graph.setLayoutManager(new SpringForceLayoutManager(canvasWidth, canvasHeight));
            graph.layout();

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
            EventPassagesGraphStorageManager.clearFromMemory(eventId);
        } else {
            // Clear all graphs
            for (const key of Object.keys(localStorage)) {
                if (key.startsWith(this.STORAGE_PREFIX)) {
                    localStorage.removeItem(key);
                }
            }
            EventPassagesGraphStorageManager.clearAllFromMemory();
        }
    }
}