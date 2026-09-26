import { Graph } from '../../../Graph';
import { NodeVisualObject } from '../../../NodeVisualObject';
import { PassageEdgeVisualObject } from '../../PassageEdgeVisualObject';
import { PassageNodeVisualObject } from '../../PassageNodeVisualObject';
import type { TGraphPassages } from '../graphPassage';
import { EdgeFactory } from './EdgeFactory';

export class EdgeActualizer {
    private edgeCounter = 0;
    private edgeFactory: EdgeFactory;

    constructor() {
        this.edgeFactory = new EdgeFactory();
    }

    actualizeEdges(graph: Graph, passages: TGraphPassages): void {
        const existingEdges = this.mapExistingEdges(graph);
        this.processPassageEdges(graph, passages, existingEdges);
        this.removeObsoleteEdges(graph, existingEdges);
    }

    private mapExistingEdges(graph: Graph): Map<string, PassageEdgeVisualObject> {
        const existingEdges = new Map<string, PassageEdgeVisualObject>();

        for (const edge of graph.getAllEdges()) {
            if (!(edge instanceof PassageEdgeVisualObject)) continue;

            const sourceId = this.getNodePassageId(edge.getSource());
            const targetId = this.getNodePassageId(edge.getTarget());
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

    private processPassageEdges(
        graph: Graph,
        passages: TGraphPassages,
        existingEdges: Map<string, PassageEdgeVisualObject>
    ): void {
        for (const [passageId, passage] of Object.entries(passages)) {
            const sourceNode = graph.getNode(passageId);
            if (!sourceNode) continue;

            const newEdges = this.edgeFactory.createEdges({
                passage,
                passageId,
                sourceNode,
                getTargetNode: (targetId: string) => graph.getNode(targetId),
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

    private removeObsoleteEdges(graph: Graph, existingEdges: Map<string, PassageEdgeVisualObject>): void {
        for (const edge of existingEdges.values()) {
            for (const [id, graphEdge] of Object.entries(graph.getAllEdges())) {
                if (graphEdge === edge) {
                    graph.removeEdge(id);
                    break;
                }
            }
        }
    }
}
