import { NodeVisualObject } from '../../../NodeVisualObject';
import { ColorManager } from '../ColorManager';
import type { TGraphPassage } from '../graphPassage';
import { LinearPassageNodeCreator } from './creators/LinearPassageNodeCreator';
import { ScreenPassageNodeCreator } from './creators/ScreenPassageNodeCreator';
import { TransitionPassageNodeCreator } from './creators/TransitionPassageNodeCreator';

export class NodeFactory {
    private screenNodeCreator: ScreenPassageNodeCreator;
    private transitionNodeCreator: TransitionPassageNodeCreator;
    private linearNodeCreator: LinearPassageNodeCreator;

    constructor(colorManager: ColorManager) {
        this.screenNodeCreator = new ScreenPassageNodeCreator(colorManager);
        this.transitionNodeCreator = new TransitionPassageNodeCreator(colorManager);
        this.linearNodeCreator = new LinearPassageNodeCreator(colorManager);
    }

    createNode(passage: TGraphPassage): NodeVisualObject | undefined {
        switch (passage.type) {
            case 'screen':
                return this.screenNodeCreator.create(passage);
            case 'transition':
                return this.transitionNodeCreator.create(passage);
            case 'linear':
                return this.linearNodeCreator.create(passage);
            default:
                console.warn(`Unknown passage type: ${(passage as TGraphPassage).type}`);
                return undefined;
        }
    }
}
