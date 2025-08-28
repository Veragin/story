import * as sinon from 'sinon';
import { HoverableVisualObject } from '../../../../../../../src/code/Visualizer/GUIComponents/Canvas/Node/HoverableVisualObject';
import { TPoint, TSize } from '../../../../../../../src/code/Visualizer/GUIComponents/Canvas/CanvasManager/CanvasWorld';

export class MockHoverableObject extends HoverableVisualObject {
    public drawSpy = sinon.stub();
    
    constructor(
        position: TPoint = { x: 0, y: 0 },
        size: TSize = { width: 10, height: 10 },
        zIndex: number = 0
    ) {
        super(position, size, zIndex);
    }

    draw(ctx: CanvasRenderingContext2D): void {
        this.drawSpy(ctx);
    }
}
