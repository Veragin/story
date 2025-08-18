import { Graph } from '../../Graph';
import { GraphSerializer } from './GraphSerializer';
import { throttle } from 'code/utils/throttle';

export class ChapterPassagesGraphStorageManager {
    private static graphs: Map<string, Graph> = new Map();
    private static readonly STORAGE_PREFIX = 'passage-graph-';

    /**
     * Retrieves a graph from in-memory storage
     * @param chapterId The chapter ID to retrieve the graph for
     * @returns The graph if found in memory, null otherwise
     */
    static getInMemoryGraph(chapterId: string): Graph | null {
        return this.graphs.get(chapterId) || null;
    }

    /**
     * Stores a graph in memory
     * @param chapterId The chapter ID to store the graph for
     * @param graph The graph to store
     */
    static storeInMemory(chapterId: string, graph: Graph): void {
        this.graphs.set(chapterId, graph);
    }

    /**
     * Removes a specific graph from memory
     * @param chapterId The chapter ID to remove from memory
     */
    static clearFromMemory(chapterId: string): void {
        this.graphs.delete(chapterId);
    }

    /**
     * Clears all graphs from memory
     */
    static clearAllFromMemory(): void {
        this.graphs.clear();
    }

    /**
     * Saves a graph to localStorage with throttling
     * @param chapterId The chapter ID to save the graph for
     * @param graph The graph to save
     */
    static saveToStorage(chapterId: string, graph: Graph): void {
        this.throttleSavingGraphToStorage({ chapterId, graph });
    }

    private static throttleSavingGraphToStorage = throttle((args: { chapterId: string; graph: Graph }) => {
        try {
            const serializedGraph = GraphSerializer.serialize(args.graph);
            localStorage.setItem(this.STORAGE_PREFIX + args.chapterId, JSON.stringify(serializedGraph));
        } catch (error) {
            console.error('Failed to save graph to storage:', error);
        }
    }, 500);

    /**
     * Gets the storage key prefix for passage graphs
     */
    static getStoragePrefix(): string {
        return this.STORAGE_PREFIX;
    }

    /**
     * Checks if there are any graphs currently stored in memory
     */
    static hasGraphsInMemory(): boolean {
        return this.graphs.size > 0;
    }

    /**
     * Gets all chapter IDs that have graphs currently stored in memory
     */
    static getInMemoryChapterIds(): string[] {
        return Array.from(this.graphs.keys());
    }
}