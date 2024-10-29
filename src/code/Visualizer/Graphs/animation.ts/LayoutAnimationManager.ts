import { Graph } from "../Graph";
import { GraphLayoutManager } from "../graphLayouts/GraphLayoutManager";

export class GraphAnimationHandler {
    private graph: Graph;
    private layoutManager: GraphLayoutManager;
    isAnimationRunning: any;

    constructor(graph: Graph, layoutManager: GraphLayoutManager) {
        this.graph = graph;
        this.layoutManager = layoutManager;
    }

    public startAnimation(delay: number = 80): void {
        this.isAnimationRunning = true;
        setInterval(() => {
            if (!this.isAnimationRunning) 
                return;

            this.layoutManager.performSingleIteration(this.graph);
        }, delay);
        

    }

    public stopAnimation(): void {
        this.isAnimationRunning = false;
    }

    public isAnimating(): boolean {
        return this.isAnimationRunning;
    }
}