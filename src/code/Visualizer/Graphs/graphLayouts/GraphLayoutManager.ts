import { Graph } from "../Graph";


export interface GraphLayoutManager {
    layout(graph: Graph): void;
    performSingleIteration(graph: Graph, screenSize: TSize): void;
    destroy(): void;
}
