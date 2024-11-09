import { PassageEdgeVisualObject } from "code/Visualizer/Graphs/EventPassagesGraph/PassageEdgeVisualObject";
import { AbstractPassageEdgeCreator, EdgeCreationParams } from "../AbstractPassageEdgeCreator";


export class LinearPassageEdgeCreator extends AbstractPassageEdgeCreator {
    createEdges(params: EdgeCreationParams): PassageEdgeVisualObject[] {
        const { passage, sourceNode, getTargetNode } = params;
        const edges: PassageEdgeVisualObject[] = [];

        if (passage.nextPassageId) {
            const targetNode = getTargetNode(passage.nextPassageId);
            if (targetNode) {
                edges.push(
                    this.createEdge({
                        source: sourceNode,
                        target: targetNode,
                        zIndex: 0,
                        color: '#666666',
                        style: 'solid'
                    })
                );
            }
        }

        return edges;
    }
}