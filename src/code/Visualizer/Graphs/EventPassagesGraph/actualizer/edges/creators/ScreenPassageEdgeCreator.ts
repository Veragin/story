import { PassageEdgeVisualObject } from "code/Visualizer/Graphs/EventPassagesGraph/PassageEdgeVisualObject";
import { AbstractPassageEdgeCreator, EdgeCreationParams } from "../AbstractPassageEdgeCreator";

export class ScreenPassageEdgeCreator extends AbstractPassageEdgeCreator {
    createEdges(params: EdgeCreationParams): PassageEdgeVisualObject[] {
        const { passage, sourceNode, getTargetNode } = params;
        const edges: PassageEdgeVisualObject[] = [];

        for (const section of passage.body) {
            
            // Handle links
            if (section.links) {
                for (const link of section.links) {
                    const targetNode = getTargetNode(link.passageId);
                    if (targetNode) {
                        edges.push(
                            this.createEdge({
                                source: sourceNode,
                                target: targetNode,
                                zIndex: 1,
                                color: '#999999',
                                style: 'solid'
                            })
                        );
                    }
                }
            }

            // Handle redirects
            if (section.redirect) {
                const targetNode = getTargetNode(section.redirect);
                if (targetNode) {
                    edges.push(
                        this.createEdge({
                            source: sourceNode,
                            target: targetNode,
                            zIndex: 0,
                            color: '#ff0000',
                            style: 'solid'
                        })
                    );
                }
            }
        }

        return edges;
    }
}
