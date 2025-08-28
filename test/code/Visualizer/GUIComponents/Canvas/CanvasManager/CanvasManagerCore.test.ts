// @ts-nocheck

// Fallback DOM setup in case global setup doesn't load
if (typeof document === 'undefined') {
    const { JSDOM } = require('jsdom');
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
        pretendToBeVisual: true,
        resources: 'usable'
    });
    
    (global as any).window = dom.window;
    (global as any).document = dom.window.document;
    (global as any).navigator = dom.window.navigator;
    (global as any).HTMLElement = dom.window.HTMLElement;
    (global as any).HTMLCanvasElement = dom.window.HTMLCanvasElement;
    (global as any).CanvasRenderingContext2D = dom.window.CanvasRenderingContext2D;
    (global as any).MouseEvent = dom.window.MouseEvent;
    (global as any).KeyboardEvent = dom.window.KeyboardEvent;
    
    (global as any).requestAnimationFrame = (callback: FrameRequestCallback) => {
        return setTimeout(callback, 0);
    };
    
    (global as any).cancelAnimationFrame = (id: number) => {
        clearTimeout(id);
    };
}

import * as assert from 'assert';
import * as sinon from 'sinon';
import { CanvasManagerCore } from '../../../../../../src/code/Visualizer/GUIComponents/Canvas/CanvasManager/CanvasManagerCore';
import { MouseButton } from '../../../../../../src/code/Visualizer/GUIComponents/Canvas/CanvasManager/InputConstants';
import {
    createMouseEvent,
    createMockCanvas,
    MockVisualObject,
    MockHoverableObject,
    MockClickableObject,
    MockDraggableObject
} from './helpers';

suite('CanvasManagerCore - Object Management', () => {
    let canvasManagerCore: CanvasManagerCore;
    let mockCanvas: HTMLCanvasElement;
    let documentAddEventListenerStub: sinon.SinonStub;
    let documentRemoveEventListenerStub: sinon.SinonStub;

    setup(() => {
        mockCanvas = createMockCanvas();
        documentAddEventListenerStub = sinon.stub(document, 'addEventListener');
        documentRemoveEventListenerStub = sinon.stub(document, 'removeEventListener');
        
        canvasManagerCore = new CanvasManagerCore(mockCanvas);
    });

    teardown(() => {
        canvasManagerCore.dispose();
        sinon.restore();
    });

    test('should add visual object successfully', () => {
        const mockObject = new MockVisualObject();
        const onObjectAddedSpy = sinon.spy();
        canvasManagerCore.onObjectAdded.subscribe(onObjectAddedSpy);

        canvasManagerCore.addObject(mockObject);

        assert.ok(canvasManagerCore.hasObject(mockObject), 'Object should be added to manager');
        assert.ok(onObjectAddedSpy.calledOnceWith(mockObject), 'onObjectAdded should be notified');
    });

    test('should remove visual object successfully', () => {
        const mockObject = new MockVisualObject();
        const onObjectRemovedSpy = sinon.spy();
        canvasManagerCore.onObjectRemoved.subscribe(onObjectRemovedSpy);
        
        canvasManagerCore.addObject(mockObject);
        canvasManagerCore.removeObject(mockObject);

        assert.ok(!canvasManagerCore.hasObject(mockObject), 'Object should be removed from manager');
        assert.ok(onObjectRemovedSpy.calledOnceWith(mockObject), 'onObjectRemoved should be notified');
    });

    test('should return all objects in iteration', () => {
        const obj1 = new MockVisualObject();
        const obj2 = new MockVisualObject();
        
        canvasManagerCore.addObject(obj1);
        canvasManagerCore.addObject(obj2);
        
        const allObjects = Array.from(canvasManagerCore.getAllObjects());
        
        assert.strictEqual(allObjects.length, 2, 'Should return exactly 2 objects');
        assert.ok(allObjects.includes(obj1), 'Should include first object');
        assert.ok(allObjects.includes(obj2), 'Should include second object');
    });

    test('should handle object property changes', () => {
        const mockObject = new MockVisualObject();
        const onPropertyChangedSpy = sinon.spy();
        canvasManagerCore.onObjectPropertyChanged.subscribe(onPropertyChangedSpy);
        
        canvasManagerCore.addObject(mockObject);
        mockObject.onPropertyChanged.notify({ property: 'position', VisualObject: mockObject });

        assert.ok(onPropertyChangedSpy.calledOnce, 'Property change should be forwarded');
        const args = onPropertyChangedSpy.firstCall.args[0];
        assert.strictEqual(args.object, mockObject, 'Object should match');
        assert.strictEqual(args.property, 'position', 'Property should match');
    });
});

suite('CanvasManagerCore - Canvas Size and Cursor', () => {
    let canvasManagerCore: CanvasManagerCore;
    let mockCanvas: HTMLCanvasElement;

    setup(() => {
        mockCanvas = createMockCanvas();
        canvasManagerCore = new CanvasManagerCore(mockCanvas);
    });

    teardown(() => {
        canvasManagerCore.dispose();
        sinon.restore();
    });

    test('should return correct canvas size', () => {
        const size = canvasManagerCore.getCanvasSize();
        
        assert.strictEqual(size.width, 800, 'Width should match clientWidth');
        assert.strictEqual(size.height, 600, 'Height should match clientHeight');
    });

    test('should update cursor correctly', () => {
        const cursor = 'pointer';
        
        canvasManagerCore.updateCursor(cursor);
        
        assert.strictEqual(mockCanvas.style.cursor, cursor, 'Cursor should be updated');
    });

    test('should notify on canvas resize', () => {
        const onCanvasResizeSpy = sinon.spy();
        canvasManagerCore.onCanvasResize.subscribe(onCanvasResizeSpy);
        
        // Use forceNotify to establish a baseline size first
        canvasManagerCore.onCanvasResize.forceNotify({ width: 800, height: 600 });
        
        // Now trigger resize notification with new size (different from baseline)
        canvasManagerCore.onCanvasResize.notify({ width: 1000, height: 800 });
        
        assert.ok(onCanvasResizeSpy.calledTwice, 'Canvas resize should be notified twice');
        // Check the second call (the actual resize notification)
        const args = onCanvasResizeSpy.secondCall.args[0];
        assert.strictEqual(args.width, 1000, 'New width should match');
        assert.strictEqual(args.height, 800, 'New height should match');
    });
});

suite('CanvasManagerCore - Mouse Event Handling', () => {
    let canvasManagerCore: CanvasManagerCore;
    let mockCanvas: HTMLCanvasElement;
    let mockHoverableObject: MockHoverableObject;
    let mockDraggableObject: MockDraggableObject;
    let mockClickableObject: MockClickableObject;

    setup(() => {
        mockCanvas = createMockCanvas();
        canvasManagerCore = new CanvasManagerCore(mockCanvas);
        
        mockHoverableObject = new MockHoverableObject({ x: 10, y: 10 }, { width: 20, height: 20 });
        mockDraggableObject = new MockDraggableObject({ x: 50, y: 50 }, { width: 30, height: 30 });
        mockClickableObject = new MockClickableObject({ x: 100, y: 100 }, { width: 25, height: 25 });
        
        canvasManagerCore.addObject(mockHoverableObject);
        canvasManagerCore.addObject(mockDraggableObject);
        canvasManagerCore.addObject(mockClickableObject);
    });

    teardown(() => {
        canvasManagerCore.dispose();
        sinon.restore();
    });

    test('should handle hover events correctly', () => {
        const onHoverEnterSpy = sinon.spy();
        mockHoverableObject.onHoverEnter.subscribe(onHoverEnterSpy);

        const mouseEvent = createMouseEvent('mousemove', {
            offsetX: 15,
            offsetY: 15
        });

        canvasManagerCore['handleMouseMove'](mouseEvent);

        assert.ok(onHoverEnterSpy.called, 'Hoverable object should receive hover event');
        assert.ok(mockHoverableObject.isHovered(), 'Object should be in hovered state');
    });

    test('should start dragging on mouse down', () => {
        const onDragStartSpy = sinon.spy();
        mockDraggableObject.onDragStart.subscribe(onDragStartSpy);

        const mouseEvent = createMouseEvent('mousedown', {
            button: MouseButton.LEFT,
            offsetX: 60,
            offsetY: 60
        });

        canvasManagerCore['handleMouseDown'](mouseEvent);

        assert.ok(onDragStartSpy.called, 'Draggable object should start dragging');
        assert.ok(mockDraggableObject.isDragging(), 'Object should be in dragging state');
    });

    test('should continue dragging on mouse move', () => {
        const onDragMoveSpy = sinon.spy();
        mockDraggableObject.onDragMove.subscribe(onDragMoveSpy);

        // First start dragging
        const mouseDownEvent = createMouseEvent('mousedown', {
            button: MouseButton.LEFT,
            offsetX: 60,
            offsetY: 60
        });
        canvasManagerCore['handleMouseDown'](mouseDownEvent);

        // Then move mouse
        const mouseMoveEvent = createMouseEvent('mousemove', {
            offsetX: 70,
            offsetY: 70
        });
        canvasManagerCore['handleMouseMove'](mouseMoveEvent);

        assert.ok(onDragMoveSpy.called, 'Draggable object should receive drag event');
    });

    test('should end dragging on mouse up', () => {
        const onDragEndSpy = sinon.spy();
        mockDraggableObject.onDragEnd.subscribe(onDragEndSpy);

        // Start dragging first
        const mouseDownEvent = createMouseEvent('mousedown', {
            button: MouseButton.LEFT,
            offsetX: 60,
            offsetY: 60
        });
        canvasManagerCore['handleMouseDown'](mouseDownEvent);

        // Then mouse up
        const mouseUpEvent = createMouseEvent('mouseup', {
            offsetX: 65,
            offsetY: 65
        });
        canvasManagerCore['handleMouseUp'](mouseUpEvent);

        assert.ok(onDragEndSpy.called, 'Draggable object should end dragging');
        assert.ok(!mockDraggableObject.isDragging(), 'Object should not be in dragging state');
    });

    test('should handle click events correctly', () => {
        const onClickSpy = sinon.spy();
        mockClickableObject.onClick.subscribe(onClickSpy);

        const mouseEvent = createMouseEvent('click', {
            offsetX: 110,
            offsetY: 110
        });

        canvasManagerCore['handleMouseClick'](mouseEvent);

        assert.ok(onClickSpy.called, 'Clickable object should receive click event');
    });

    test('should handle double click events correctly', () => {
        const onDbClickSpy = sinon.spy();
        mockClickableObject.onDbClick.subscribe(onDbClickSpy);

        const mouseEvent = createMouseEvent('dblclick', {
            offsetX: 110,
            offsetY: 110
        });

        canvasManagerCore['handleMouseDbClick'](mouseEvent);

        assert.ok(onDbClickSpy.called, 'Clickable object should receive double click event');
    });

    test('should handle right mouse button down', () => {
        const onRightDownSpy = sinon.spy();
        mockClickableObject.onRightDown.subscribe(onRightDownSpy);

        const mouseEvent = createMouseEvent('mousedown', {
            button: MouseButton.RIGHT,
            offsetX: 110,
            offsetY: 110
        });

        canvasManagerCore['handleMouseDown'](mouseEvent);

        assert.ok(onRightDownSpy.called, 'Clickable object should receive right down event');
    });

    test('should prevent context menu', () => {
        const contextMenuEvent = createMouseEvent('contextmenu', {
            offsetX: 100,
            offsetY: 100
        });
        const preventDefaultSpy = sinon.spy(contextMenuEvent, 'preventDefault');

        const result = canvasManagerCore['handleContextMenu'](contextMenuEvent);

        assert.ok(preventDefaultSpy.called, 'preventDefault should be called');
        assert.strictEqual(result, false, 'Should return false to prevent default');
    });
});

suite('CanvasManagerCore - Keyboard Event Handling', () => {
    let canvasManagerCore: CanvasManagerCore;
    let mockCanvas: HTMLCanvasElement;
    let eventDispatcherSpy: sinon.SinonSpy;

    setup(() => {
        mockCanvas = createMockCanvas();
        canvasManagerCore = new CanvasManagerCore(mockCanvas);
        eventDispatcherSpy = sinon.spy(canvasManagerCore.eventDispatcher, 'dispatchKeyDown');
    });

    teardown(() => {
        canvasManagerCore.dispose();
        sinon.restore();
    });

    test('should dispatch keyboard events', () => {
        const keyboardEvent = new KeyboardEvent('keydown', { code: 'Space' });

        canvasManagerCore['handleKeyDown'](keyboardEvent);

        assert.ok(eventDispatcherSpy.calledOnceWith(keyboardEvent), 'Keyboard event should be dispatched');
    });
});

suite('CanvasManagerCore - Drawing', () => {
    let canvasManagerCore: CanvasManagerCore;
    let mockCanvas: HTMLCanvasElement;
    let mockContext: CanvasRenderingContext2D;
    let drawStub: sinon.SinonStub;

    setup(() => {
        mockCanvas = createMockCanvas();
        mockContext = mockCanvas.getContext('2d') as CanvasRenderingContext2D;
        canvasManagerCore = new CanvasManagerCore(mockCanvas);
        
        // Replace the throttled draw with immediate execution for testing
        drawStub = sinon.stub(canvasManagerCore, 'draw' as any).callsFake(() => {
            canvasManagerCore['clear']();
            mockContext.save();
            canvasManagerCore['applyViewportTransformation'](mockContext);
            
            const sortedObjects = canvasManagerCore.visibleVisualObjectsManager.getSortedVisibleObjects();
            for (const obj of sortedObjects) {
                obj.draw(mockContext);
            }
            
            mockContext.restore();
        });
    });

    teardown(() => {
        canvasManagerCore.dispose();
        sinon.restore();
    });

    test('should clear canvas correctly', () => {
        canvasManagerCore['clear']();

        assert.ok((mockContext.clearRect as sinon.SinonStub).calledWith(0, 0, mockCanvas.width, mockCanvas.height),
            'Canvas should be cleared with correct dimensions');
    });

    test('should request redraw', () => {
        canvasManagerCore.requestRedraw();

        assert.ok(drawStub.called, 'Draw should be called when redraw is requested');
    });

    test('should apply viewport transformation', () => {
        canvasManagerCore['applyViewportTransformation'](mockContext);

        assert.ok((mockContext.scale as sinon.SinonStub).called, 'Scale should be applied');
        assert.ok((mockContext.translate as sinon.SinonStub).called, 'Translation should be applied');
    });
});

suite('CanvasManagerCore - Event Listener Management', () => {
    let mockCanvas: HTMLCanvasElement;
    let canvasAddEventListenerSpy: sinon.SinonSpy;
    let canvasRemoveEventListenerSpy: sinon.SinonSpy;
    let documentAddEventListenerSpy: sinon.SinonSpy;
    let documentRemoveEventListenerSpy: sinon.SinonSpy;

    setup(() => {
        // Ensure completely clean state
        sinon.restore();
        
        // Create a custom mock canvas for this test suite to avoid conflicts
        const mockContext = {
            scale: sinon.stub(),
            save: sinon.stub(),
            restore: sinon.stub(),
            clearRect: sinon.stub(),
            translate: sinon.stub()
        } as unknown as CanvasRenderingContext2D;
        
        mockCanvas = {
            getContext: sinon.stub().returns(mockContext),
            addEventListener: () => {}, // Real function, not a stub
            removeEventListener: () => {}, // Real function, not a stub
            get clientWidth() { return 800; },
            get clientHeight() { return 600; },
            width: 1600,
            height: 1200,
            style: { cursor: '' }
        } as unknown as HTMLCanvasElement;
        
        // Now spy on the real methods
        canvasAddEventListenerSpy = sinon.spy(mockCanvas, 'addEventListener');
        canvasRemoveEventListenerSpy = sinon.spy(mockCanvas, 'removeEventListener');
        documentAddEventListenerSpy = sinon.spy(document, 'addEventListener');
        documentRemoveEventListenerSpy = sinon.spy(document, 'removeEventListener');
    });

    teardown(() => {
        sinon.restore();
    });

    test('should add all required event listeners on construction', () => {
        new CanvasManagerCore(mockCanvas);

        const expectedCanvasEvents = [
            'mousemove', 'mousedown', 'mouseup', 'mouseleave',
            'click', 'dblclick', 'contextmenu', 'wheel'
        ];

        for (const event of expectedCanvasEvents) {
            assert.ok(
                canvasAddEventListenerSpy.calledWith(event, sinon.match.func),
                `Canvas should have ${event} event listener added`
            );
        }

        const expectedDocumentEvents = ['keydown', 'keyup'];
        for (const event of expectedDocumentEvents) {
            assert.ok(
                documentAddEventListenerSpy.calledWith(event, sinon.match.func),
                `Document should have ${event} event listener added`
            );
        }
    });

    test('should remove all event listeners on disposal', () => {
        const canvasManagerCore = new CanvasManagerCore(mockCanvas);
        
        canvasManagerCore.dispose();

        const expectedCanvasEvents = [
            'mousemove', 'mousedown', 'mouseup', 'mouseleave',
            'click', 'dblclick', 'contextmenu', 'wheel'
        ];

        for (const event of expectedCanvasEvents) {
            assert.ok(
                canvasRemoveEventListenerSpy.calledWith(event, sinon.match.func),
                `Canvas should have ${event} event listener removed`
            );
        }

        const expectedDocumentEvents = ['keydown', 'keyup'];
        for (const event of expectedDocumentEvents) {
            assert.ok(
                documentRemoveEventListenerSpy.calledWith(event, sinon.match.func),
                `Document should have ${event} event listener removed`
            );
        }
    });
});

suite('CanvasManagerCore - Drag Mode', () => {
    let canvasManagerCore: CanvasManagerCore;
    let mockCanvas: HTMLCanvasElement;
    let mockDraggableObject: MockDraggableObject;

    setup(() => {
        mockCanvas = createMockCanvas();
        canvasManagerCore = new CanvasManagerCore(mockCanvas);
        mockDraggableObject = new MockDraggableObject({ x: 50, y: 50 });
        canvasManagerCore.addObject(mockDraggableObject);
    });

    teardown(() => {
        canvasManagerCore.dispose();
        sinon.restore();
    });

    test('should allow dragging when drag mode is enabled', () => {
        canvasManagerCore.dragMode = true;
        const onDragStartSpy = sinon.spy();
        mockDraggableObject.onDragStart.subscribe(onDragStartSpy);
        
        const mouseEvent = createMouseEvent('mousedown', {
            button: MouseButton.LEFT,
            offsetX: 60,
            offsetY: 60
        });

        canvasManagerCore['handleMouseDown'](mouseEvent);

        assert.ok(onDragStartSpy.called, 'Should start dragging when drag mode is enabled');
    });

    test('should prevent dragging when drag mode is disabled', () => {
        canvasManagerCore.dragMode = false;
        const onDragStartSpy = sinon.spy();
        mockDraggableObject.onDragStart.subscribe(onDragStartSpy);
        
        const mouseEvent = createMouseEvent('mousedown', {
            button: MouseButton.LEFT,
            offsetX: 60,
            offsetY: 60
        });

        canvasManagerCore['handleMouseDown'](mouseEvent);

        assert.ok(onDragStartSpy.notCalled, 'Should not start dragging when drag mode is disabled');
    });
});

suite('CanvasManagerCore - Z-Index Management', () => {
    let canvasManagerCore: CanvasManagerCore;
    let mockCanvas: HTMLCanvasElement;
    let mockDraggableObject: MockDraggableObject;
    let mockOtherObject: MockVisualObject;

    setup(() => {
        mockCanvas = createMockCanvas();
        canvasManagerCore = new CanvasManagerCore(mockCanvas);
        
        mockDraggableObject = new MockDraggableObject({ x: 50, y: 50 }, { width: 30, height: 30 }, 1);
        mockOtherObject = new MockVisualObject({ x: 100, y: 100 }, { width: 10, height: 10 }, 5);
        
        canvasManagerCore.addObject(mockDraggableObject);
        canvasManagerCore.addObject(mockOtherObject);
    });

    teardown(() => {
        canvasManagerCore.dispose();
        sinon.restore();
    });

    test('should bring dragged object to front', () => {
        const mouseEvent = createMouseEvent('mousedown', {
            button: MouseButton.LEFT,
            offsetX: 60,
            offsetY: 60
        });

        canvasManagerCore['handleMouseDown'](mouseEvent);

        assert.ok(mockDraggableObject.zIndex > 5, 'Dragged object should have higher z-index than other objects');
    });
});
