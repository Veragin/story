import * as sinon from 'sinon';
import { DraggableVisualObject } from '../../../../../../../src/code/Visualizer/GUIComponents/Canvas/Node/DraggableVisualObject';
import { TPoint, TSize } from '../../../../../../../src/code/Visualizer/GUIComponents/Canvas/CanvasManager/CanvasWorld';

export class MockDraggableObject extends DraggableVisualObject {
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
