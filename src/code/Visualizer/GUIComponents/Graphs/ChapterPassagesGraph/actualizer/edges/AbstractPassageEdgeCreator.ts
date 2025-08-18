import { TLineType } from "../../../EdgeVisualObject";
import { NodeVisualObject } from "../../../Node/NodeVisualObject";
import { PassageEdgeVisualObject } from "../../PassageEdgeVisualObject";

export type EdgeCreationParams = {
    passage: any;
    passageId: string;
    sourceNode: NodeVisualObject;
    getTargetNode: (targetId: string) => NodeVisualObject | undefined;
}

export abstract class AbstractPassageEdgeCreator {
    protected createEdge(params: {
        source: NodeVisualObject;
        target: NodeVisualObject;
        zIndex?: number;
        color?: string;
        style?: TLineType;
    }): PassageEdgeVisualObject {
        const {
            source,
            target,
            zIndex = 1,
            color = '#999999',
            style = 'solid'
        } = params;

        const edge = new PassageEdgeVisualObject(
            source,
            target,
            color,
            1,
            true,
            zIndex,
            style
        );

        edge.onTargetSelectedColor = 'black';
        edge.onSourceSelectedColor = '#1976d2';

        return edge;
    }

    abstract createEdges(params: EdgeCreationParams): PassageEdgeVisualObject[];
}