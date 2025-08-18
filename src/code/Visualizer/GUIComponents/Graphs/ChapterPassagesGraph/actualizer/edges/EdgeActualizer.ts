import { Graph } from "../../../Graph";
import { NodeVisualObject } from "../../../Node/NodeVisualObject";
import { PassageEdgeVisualObject } from "../../PassageEdgeVisualObject";
import { PassageNodeVisualObject } from "../../PassageNodeVisualObject";
import { worldStateCopy } from "../../WorldStateCopy";
import { EdgeFactory } from "./EdgeFactory";

export class EdgeActualizer {
    private edgeCounter = 0;
    private edgeFactory: EdgeFactory;

    constructor() {
        this.edgeFactory = new EdgeFactory();
    }

    async actualizeEdges(
        graph: Graph,
        passages: Record<string, any>,
        nodes: Record<string, NodeVisualObject>
    ): Promise<void> {
        const existingEdges = this.mapExistingEdges(graph);
        await this.processPassageEdges(graph, passages, existingEdges);
        this.removeObsoleteEdges(graph, existingEdges);
    }


    private mapExistingEdges(graph: Graph): Map<string, PassageEdgeVisualObject> {
        const existingEdges = new Map<string, PassageEdgeVisualObject>();

        for (const edge of graph.getAllEdges()) {
            if (!(edge instanceof PassageEdgeVisualObject)) 
                continue;

            let sourceId = this.getNodePassageId(edge.getSource());
            let targetId = this.getNodePassageId(edge.getTarget());
            existingEdges.set(`${sourceId}->${targetId}`, edge);
        }

        return existingEdges;
    }

    private getNodePassageId(node: NodeVisualObject): string {
        if (node instanceof PassageNodeVisualObject) {
            return node.passageId;
        }
        return node.getId();
    }

    private async processPassageEdges(
        graph: Graph,
        passages: Record<string, any>,
        existingEdges: Map<string, PassageEdgeVisualObject>
    ): Promise<void> {
        for (const [passageId, passageData] of Object.entries(passages)) {
            const sourceNode = graph.getNode(passageId);
            if (!sourceNode) 
                continue;

            const passage = typeof passageData === 'function' ?
                passageData(worldStateCopy) : passageData;

            const newEdges = this.edgeFactory.createEdges({
                passage,
                passageId,
                sourceNode,
                getTargetNode: (targetId: string) => graph.getNode(targetId)
            });

            for (const edge of newEdges) {
                const sourceId = this.getNodePassageId(edge.getSource());
                const targetId = this.getNodePassageId(edge.getTarget());
                const edgeKey = `${sourceId}->${targetId}`;

                if (!existingEdges.has(edgeKey)) {
                    graph.addEdge(edge, `edge-${this.edgeCounter++}`);
                }
                existingEdges.delete(edgeKey);
            }
        }
    }

    private removeObsoleteEdges(
        graph: Graph,
        existingEdges: Map<string, PassageEdgeVisualObject>
    ): void {
        for (const [edgeKey, edge] of existingEdges) {
            for (const [id, graphEdge] of Object.entries(graph.getAllEdges())) {
                if (graphEdge === edge) {
                    graph.removeEdge(id);
                    break;
                }
            }
        }
    }
}