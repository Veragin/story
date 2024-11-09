import { TRegisterPassageId } from "data/register";
import { NodeVisualObject } from "../../../Node/NodeVisualObject";
import { worldStateCopy } from "../../../PassagesGraph/WorldStateCopy";
import { ColorManager } from "../ColorManager";
import { LinearPassageNodeCreator } from "./creators/LinearPassageNodeCreator";
import { ScreenPassageNodeCreator } from "./creators/ScreenPassageNodeCreator";
import { TransitionPassageNodeCreator } from "./creators/TransitionPassageNodeCreator";

export class NodeFactory {
    private screenNodeCreator: ScreenPassageNodeCreator;
    private transitionNodeCreator: TransitionPassageNodeCreator;
    private linearNodeCreator: LinearPassageNodeCreator;

    constructor(
        colorManager: ColorManager,
    ) {
        this.screenNodeCreator = new ScreenPassageNodeCreator(colorManager);
        this.transitionNodeCreator = new TransitionPassageNodeCreator(colorManager);
        this.linearNodeCreator = new LinearPassageNodeCreator(colorManager);
    }

    async createNode(
        passageId: TRegisterPassageId,
        passageData: any
    ): Promise<NodeVisualObject | undefined> {
        const passage = typeof passageData === 'function'
            ? passageData(worldStateCopy)
            : passageData;

        switch (passage.type) {
            case 'screen':
                return this.screenNodeCreator.create(passageId, passage);
            case 'transition':
                return this.transitionNodeCreator.create(passageId, passage);
            case 'linear':
                return this.linearNodeCreator.create(passageId, passage);
            default:
                console.warn(`Unknown passage type: ${passage.type}`);
                return undefined;
        }
    }
}
