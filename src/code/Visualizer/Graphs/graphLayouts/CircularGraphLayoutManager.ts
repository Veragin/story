import { Graph } from "../Graph";
import { GraphLayoutManager } from "./GraphLayoutManager";



export class CircularGraphLayoutManager implements GraphLayoutManager {
    private centerX: number;
    private centerY: number;
    private radius: number;

    constructor(centerX: number, centerY: number, radius: number) {
        this.centerX = centerX;
        this.centerY = centerY;
        this.radius = radius;
    }

    layout(graph: Graph): void {
        const nodes = graph.getAllNodes();
        const nodeCount = nodes.length;
        if (nodeCount === 0) return;

        let i = 0;
        for (const node of nodes.values()) {
            const angle = (2 * Math.PI * i) / nodeCount;
            const x = this.centerX + this.radius * Math.cos(angle);
            const y = this.centerY + this.radius * Math.sin(angle);

            node.setPosition({ x, y });
            i++;
        }
    }

    performSingleIteration(): void {
        throw new Error("Method not implemented.");
    }

    destroy(): void {
        // Nothing to do
    }


}
