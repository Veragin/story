import { PassageEdgeVisualObject } from "../../PassageEdgeVisualObject";
import { EdgeCreationParams } from "./AbstractPassageEdgeCreator";
import { LinearPassageEdgeCreator } from "./creators/LinearPassageEdgeCreator";
import { ScreenPassageEdgeCreator } from "./creators/ScreenPassageEdgeCreator";

export class EdgeFactory {
    private screenEdgeCreator: ScreenPassageEdgeCreator;
    private linearEdgeCreator: LinearPassageEdgeCreator;

    constructor() {
        this.screenEdgeCreator = new ScreenPassageEdgeCreator();
        this.linearEdgeCreator = new LinearPassageEdgeCreator();
    }

    createEdges(params: EdgeCreationParams): PassageEdgeVisualObject[] {
        switch (params.passage.type) {
            case 'screen':
                return this.screenEdgeCreator.createEdges(params);
            case 'linear':
                return this.linearEdgeCreator.createEdges(params);
            default:
                console.warn(`Unknown passage type: ${params.passage.type}`);
                return [];
        }
    }
}