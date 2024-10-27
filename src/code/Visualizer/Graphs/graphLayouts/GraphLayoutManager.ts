import { Graph } from "../Graph";



export interface GraphLayoutManager {
    layout(graph: Graph): void;
}
