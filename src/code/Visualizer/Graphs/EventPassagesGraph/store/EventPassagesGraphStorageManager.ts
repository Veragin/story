import { Graph } from '../../Graph';
import { GraphSerializer } from './GraphSerializer';
import { throttle } from 'code/utils/throttle';

export class EventPassagesGraphStorageManager {
    private static graphs: Map<string, Graph> = new Map();
    private static readonly STORAGE_PREFIX = 'passage-graph-';

    /**
     * Retrieves a graph from in-memory storage
     * @param eventId The event ID to retrieve the graph for
     * @returns The graph if found in memory, null otherwise
     */
    static getInMemoryGraph(eventId: string): Graph | null {
        return this.graphs.get(eventId) || null;
    }

    /**
     * Stores a graph in memory
     * @param eventId The event ID to store the graph for
     * @param graph The graph to store
     */
    static storeInMemory(eventId: string, graph: Graph): void {
        this.graphs.set(eventId, graph);
    }

    /**
     * Removes a specific graph from memory
     * @param eventId The event ID to remove from memory
     */
    static clearFromMemory(eventId: string): void {
        this.graphs.delete(eventId);
    }

    /**
     * Clears all graphs from memory
     */
    static clearAllFromMemory(): void {
        this.graphs.clear();
    }

    /**
     * Saves a graph to localStorage with throttling
     * @param eventId The event ID to save the graph for
     * @param graph The graph to save
     */
    static saveToStorage(eventId: string, graph: Graph): void {
        this.throttleSavingGraphToStorage({ eventId, graph });
    }

    private static throttleSavingGraphToStorage = throttle((args: { eventId: string; graph: Graph }) => {
        try {
            const serializedGraph = GraphSerializer.serialize(args.graph);
            localStorage.setItem(this.STORAGE_PREFIX + args.eventId, JSON.stringify(serializedGraph));
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
     * Gets all event IDs that have graphs currently stored in memory
     */
    static getInMemoryEventIds(): string[] {
        return Array.from(this.graphs.keys());
    }
}