import { PassageEdgeVisualObject } from '../../../PassageEdgeVisualObject';
import { AbstractPassageEdgeCreator, EdgeCreationParams } from '../AbstractPassageEdgeCreator';

export class ScreenPassageEdgeCreator extends AbstractPassageEdgeCreator {
    createEdges(params: EdgeCreationParams): PassageEdgeVisualObject[] {
        const { passage, sourceNode, getTargetNode } = params;
        const edges: PassageEdgeVisualObject[] = [];

        for (const target of passage.links) {
            const targetNode = getTargetNode(target);
            if (targetNode) {
                edges.push(
                    this.createEdge({
                        source: sourceNode,
                        target: targetNode,
                        zIndex: 1,
                        color: '#999999',
                        style: 'solid',
                    })
                );
            }
        }

        for (const target of passage.redirects) {
            const targetNode = getTargetNode(target);
            if (targetNode) {
                edges.push(
                    this.createEdge({
                        source: sourceNode,
                        target: targetNode,
                        zIndex: 0,
                        color: '#ff0000',
                        style: 'solid',
                    })
                );
            }
        }

        return edges;
    }
}
