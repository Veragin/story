import { CanvasManager } from '../../CanvasManager';
import { Graph } from '../../Graph';
import { GraphDeserializer } from './GraphDeserializer';
import { GraphSerializer, SerializedGraph } from './GraphSerializer';
import { GraphActualizer } from '../actualizer/GraphActualizer';
import { SpringForceLayoutManager } from '../../graphLayouts/SpringForceLayoutManager';
import { Store } from 'code/Visualizer/stores/Store';
import { createPassageModalContent } from 'code/Visualizer/Chapters/createPassageModalContent';
import { ChapterPassagesGraphStorageManager } from './ChapterPassagesGraphStorageManager';
import { PassageNodeVisualObject } from '../PassageNodeVisualObject';
import { register, TRegisterPassageId } from 'data/register';
import { worldStateCopy } from '../WorldStateCopy';
import { PassageResolver } from './PassageResolver';
import { e } from 'worldState';

export class GraphProvider {
    private static readonly STORAGE_PREFIX = 'passage-graph-';
    private static graphActualizer: GraphActualizer = new GraphActualizer();

    static async getGraph(chapterId: string, canvasManager: CanvasManager, store: Store): Promise<Graph> {
        // First check if graph exists in memory
        const inMemoryGraph = ChapterPassagesGraphStorageManager.getInMemoryGraph(chapterId);
        if (inMemoryGraph) {
            // Graph is already set up, just add to canvas manager
            this.addGraphToCanvasManager(inMemoryGraph, canvasManager);
            return inMemoryGraph;
        }

        const canvasWidth = canvasManager.getWidth() ?? 0;
        const canvasHeight = canvasManager.getHeight() ?? 0;

        // Try to load from localStorage
        const storedGraph = this.loadGraphFromStorage(chapterId, canvasManager);
        if (storedGraph) {
            // Verify and update stored graph data using GraphActualizer
            await this.graphActualizer.actualizeGraphData(chapterId, storedGraph);

            // Setup the graph since it came from storage
            this.setupGraph(chapterId, storedGraph, store);

            // Store in memory for next time
            ChapterPassagesGraphStorageManager.storeInMemory(chapterId, storedGraph);

            return storedGraph;
        }

        // Create new empty graph and let GraphActualizer populate it
        const newGraph = await this.createNewGraph(chapterId, canvasManager, canvasWidth, canvasHeight);

        this.setupGraph(chapterId, newGraph, store);

        // Store in memory and localStorage
        ChapterPassagesGraphStorageManager.storeInMemory(chapterId, newGraph);
        this.saveGraphToStorage(chapterId, newGraph);

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

    private static setupGraph(chapterId: string, graph: Graph, store: Store): void {
        this.setupGraphAutoSave(chapterId, graph);
        this.setupToolsWindow(chapterId, graph, store);
    }

    private static async setupToolsWindow(chapterId: string, graph: Graph, store: Store): Promise<void> {
        // Validate chapterId is a valid passage key
        if (!(chapterId in register.passages)) {
            console.error(`Chapter '${chapterId}' not found in register.passages`);
            return;
        }

        const typedChapterId = chapterId as TRegisterPassageId;

        // Preload all passages for this chapter
        await PassageResolver.preloadChapterPassages(typedChapterId);

        for (const node of graph.getAllNodes()) {
            if (node instanceof PassageNodeVisualObject) {
                const passageNodeRef = node as PassageNodeVisualObject;

                passageNodeRef.onClick.subscribe(async () => {
                    const passage = await PassageResolver.getPassage(
                        typedChapterId,
                        passageNodeRef.passageId,
                        worldStateCopy,
                        e
                    );
                    store.setModalContent(createPassageModalContent(passage));
                });

            }
        }
    }

    private static setupGraphAutoSave(chapterId: string, graph: Graph): void {
        const saveGraphCallback = () => {
            this.saveGraphToStorage(chapterId, graph);
        };

        // Subscribe to graph structure changes
        graph.onNodeAdded.subscribe((node) => {
            node.onPropertyChanged.subscribe(saveGraphCallback);
            this.saveGraphToStorage(chapterId, graph);
        });

        graph.onNodeRemoved.subscribe((node) => {
            node.onPropertyChanged.unsubscribe(saveGraphCallback);
            this.saveGraphToStorage(chapterId, graph);
        });

        graph.onEdgeAdded.subscribe((edge) => {
            edge.onPropertyChanged.subscribe(saveGraphCallback);
            this.saveGraphToStorage(chapterId, graph);
        });

        graph.onEdgeRemoved.subscribe((edge) => {
            edge.onPropertyChanged.unsubscribe(saveGraphCallback);
            this.saveGraphToStorage(chapterId, graph);
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

    private static saveGraphToStorage(chapterId: string, graph: Graph): void {
        ChapterPassagesGraphStorageManager.saveToStorage(chapterId, graph);
    }

    private static loadGraphFromStorage(chapterId: string, canvasManager: CanvasManager): Graph | null {
        try {
            const storageKey = this.STORAGE_PREFIX + chapterId;
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
        chapterId: string,
        canvasManager: CanvasManager,
        canvasWidth: number,
        canvasHeight: number
    ): Promise<Graph> {
        // Create empty graph with appropriate layout manager
        const graph = new Graph(canvasManager);

        try {
            // Let GraphActualizer populate the graph
            const populatedGraph = await this.graphActualizer.actualizeGraphData(chapterId, graph);

            graph.setLayoutManager(new SpringForceLayoutManager(canvasWidth, canvasHeight));
            graph.layout();

            return populatedGraph;
        } catch (error) {
            console.error('Failed to create new graph:', error);
            throw new Error(`Failed to create graph for chapter ${chapterId}`);
        }
    }

    static clearStorage(chapterId?: string): void {
        if (chapterId) {
            // Clear specific chapter graph
            localStorage.removeItem(this.STORAGE_PREFIX + chapterId);
            ChapterPassagesGraphStorageManager.clearFromMemory(chapterId);
        } else {
            // Clear all graphs
            for (const key of Object.keys(localStorage)) {
                if (key.startsWith(this.STORAGE_PREFIX)) {
                    localStorage.removeItem(key);
                }
            }
            ChapterPassagesGraphStorageManager.clearAllFromMemory();
        }
    }
}