import * as sinon from 'sinon';

// --- Mock Canvas and Context ---
export function createMockCanvas(): HTMLCanvasElement {
    const mockCanvas = {
        getContext: sinon.stub(),
        addEventListener: sinon.stub(),
        removeEventListener: sinon.stub(),
        get clientWidth() { return 800; },
        get clientHeight() { return 600; },
        width: 1600,
        height: 1200,
        style: { cursor: '' }
    } as unknown as HTMLCanvasElement;

    const mockContext = {
        scale: sinon.stub(),
        save: sinon.stub(),
        restore: sinon.stub(),
        clearRect: sinon.stub(),
        translate: sinon.stub()
    } as unknown as CanvasRenderingContext2D;

    (mockCanvas.getContext as sinon.SinonStub).returns(mockContext);
    return mockCanvas;
}
