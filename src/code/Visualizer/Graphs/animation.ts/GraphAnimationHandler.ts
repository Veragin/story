import { Graph } from "../Graph";
import { GraphLayoutManager } from "../graphLayouts/GraphLayoutManager";

export class GraphAnimationHandler {
    private graph: Graph;
    private layoutManager: GraphLayoutManager;
    private animationFrameId: number | null = null;
    private lastFrameTime: number = 0;
    private readonly targetFPS: number = 60;
    private readonly frameInterval: number = 1000 / 60; // For 60 FPS
    isAnimationRunning: boolean = false;

    constructor(graph: Graph) {
        this.graph = graph;
        this.layoutManager = graph.getLayoutManager();
    }
 
    public startAnimation(): void {
        if (this.isAnimationRunning) 
            return;
        
        this.isAnimationRunning = true;
        this.lastFrameTime = performance.now();
        this.animate();
    }

    private animate = (currentTime: number = 0): void => {
        if (!this.isAnimationRunning) 
            return;

        // Calculate time since last frame
        const deltaTime = currentTime - this.lastFrameTime;

    
        if (deltaTime >= this.frameInterval) {
            // Update last frame time, accounting for potential dropped frames
            this.lastFrameTime = currentTime - (deltaTime % this.frameInterval);

            // Perform layout iteration
            this.layoutManager.performSingleIteration(this.graph);
        }

        // Request next frame
        this.animationFrameId = requestAnimationFrame(this.animate);
    }

    public stopAnimation(): void {
        this.isAnimationRunning = false;
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    public isAnimating(): boolean {
        return this.isAnimationRunning;
    }

    public cleanup(): void {
        this.stopAnimation();
    }
}