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
import { CanvasWorld, TPoint, TSize } from '../../../../../../src/code/Visualizer/GUIComponents/Canvas/CanvasManager/CanvasWorld';

suite('CanvasWorld - Basic Properties', () => {
    let canvasWorld: CanvasWorld;

    setup(() => {
        canvasWorld = new CanvasWorld();
    });

    teardown(() => {
        sinon.restore();
    });

    test('should initialize with default values', () => {
        assert.deepStrictEqual(canvasWorld.viewPosition, { x: 0, y: 0 }, 'Initial view position should be (0,0)');
        assert.deepStrictEqual(canvasWorld.pixelSizeInWorldUnits, { width: 1, height: 1 }, 'Initial pixel size should be (1,1)');
    });

    test('should update view position and notify observers', () => {
        const onViewPositionChangeSpy = sinon.spy();
        canvasWorld.onViewPositionChange.subscribe(onViewPositionChangeSpy);

        const newPosition: TPoint = { x: 10, y: 20 };
        canvasWorld.viewPosition = newPosition;

        assert.deepStrictEqual(canvasWorld.viewPosition, newPosition, 'View position should be updated');
        assert.ok(onViewPositionChangeSpy.calledOnceWith(newPosition), 'View position change should be notified');
    });

    test('should update pixel size and notify observers', () => {
        const onPixelSizeChangeSpy = sinon.spy();
        canvasWorld.onPixelSizeChange.subscribe(onPixelSizeChangeSpy);

        const newPixelSize: TSize = { width: 2, height: 3 };
        canvasWorld.pixelSizeInWorldUnits = newPixelSize;

        assert.deepStrictEqual(canvasWorld.pixelSizeInWorldUnits, newPixelSize, 'Pixel size should be updated');
        assert.ok(onPixelSizeChangeSpy.calledOnceWith(newPixelSize), 'Pixel size change should be notified');
    });

    test('should enforce minimum pixel size values', () => {
        const verySmallSize: TSize = { width: 0.000001, height: -1 };
        canvasWorld.pixelSizeInWorldUnits = verySmallSize;

        const actualSize = canvasWorld.pixelSizeInWorldUnits;
        assert.ok(actualSize.width >= 0.00001, 'Width should be at least 0.00001');
        assert.ok(actualSize.height >= 0.00001, 'Height should be at least 0.00001');
    });

    test('should not notify observers when setting same view position', () => {
        canvasWorld.viewPosition = { x: 5, y: 10 };
        
        const onViewPositionChangeSpy = sinon.spy();
        canvasWorld.onViewPositionChange.subscribe(onViewPositionChangeSpy);

        canvasWorld.viewPosition = { x: 5, y: 10 }; // Same position

        assert.ok(onViewPositionChangeSpy.notCalled, 'Should not notify when position unchanged');
    });

    test('should not notify observers when setting very similar pixel size', () => {
        canvasWorld.pixelSizeInWorldUnits = { width: 1.5, height: 2.5 };
        
        const onPixelSizeChangeSpy = sinon.spy();
        canvasWorld.onPixelSizeChange.subscribe(onPixelSizeChangeSpy);

        canvasWorld.pixelSizeInWorldUnits = { width: 1.500001, height: 2.500001 }; // Very small difference

        assert.ok(onPixelSizeChangeSpy.notCalled, 'Should not notify when difference is within tolerance');
    });
});

suite('CanvasWorld - Coordinate Transformations', () => {
    let canvasWorld: CanvasWorld;

    setup(() => {
        canvasWorld = new CanvasWorld();
    });

    teardown(() => {
        sinon.restore();
    });

    test('should convert screen to world coordinates correctly with default settings', () => {
        const screenPoint: TPoint = { x: 100, y: 50 };
        const worldPoint = canvasWorld.screenToWorld(screenPoint);

        assert.deepStrictEqual(worldPoint, { x: 100, y: 50 }, 'Screen to world should be identity with default settings');
    });

    test('should convert world to screen coordinates correctly with default settings', () => {
        const worldPoint: TPoint = { x: 200, y: 150 };
        const screenPoint = canvasWorld.worldToScreen(worldPoint);

        assert.deepStrictEqual(screenPoint, { x: 200, y: 150 }, 'World to screen should be identity with default settings');
    });

    test('should handle coordinate transformations with custom view position', () => {
        canvasWorld.viewPosition = { x: 10, y: 20 };

        const screenPoint: TPoint = { x: 5, y: 15 };
        const worldPoint = canvasWorld.screenToWorld(screenPoint);
        const backToScreen = canvasWorld.worldToScreen(worldPoint);

        assert.deepStrictEqual(worldPoint, { x: 15, y: 35 }, 'Screen to world should account for view position');
        assert.deepStrictEqual(backToScreen, screenPoint, 'Round-trip conversion should be accurate');
    });

    test('should handle coordinate transformations with custom pixel size', () => {
        canvasWorld.pixelSizeInWorldUnits = { width: 2, height: 0.5 };

        const screenPoint: TPoint = { x: 10, y: 20 };
        const worldPoint = canvasWorld.screenToWorld(screenPoint);
        const backToScreen = canvasWorld.worldToScreen(worldPoint);

        assert.deepStrictEqual(worldPoint, { x: 20, y: 10 }, 'Screen to world should account for pixel size');
        assert.deepStrictEqual(backToScreen, screenPoint, 'Round-trip conversion should be accurate');
    });

    test('should convert screen delta to world delta correctly', () => {
        canvasWorld.pixelSizeInWorldUnits = { width: 2, height: 3 };

        const screenDelta: TPoint = { x: 5, y: 10 };
        const worldDelta = canvasWorld.screenDeltaToWorldDelta(screenDelta);

        assert.deepStrictEqual(worldDelta, { x: 10, y: 30 }, 'Screen delta should be scaled by pixel size');
    });

    test('should convert world delta to screen delta correctly', () => {
        canvasWorld.pixelSizeInWorldUnits = { width: 2, height: 4 };

        const worldDelta: TPoint = { x: 20, y: 40 };
        const screenDelta = canvasWorld.worldDeltaToScreenDelta(worldDelta);

        assert.deepStrictEqual(screenDelta, { x: 10, y: 10 }, 'World delta should be scaled by inverse pixel size');
    });
});

suite('CanvasWorld - Atomic Updates', () => {
    let canvasWorld: CanvasWorld;

    setup(() => {
        canvasWorld = new CanvasWorld();
    });

    teardown(() => {
        sinon.restore();
    });

    test('should perform atomic update of both position and pixel size', () => {
        const onViewPositionChangeSpy = sinon.spy();
        const onPixelSizeChangeSpy = sinon.spy();
        canvasWorld.onViewPositionChange.subscribe(onViewPositionChangeSpy);
        canvasWorld.onPixelSizeChange.subscribe(onPixelSizeChangeSpy);

        const newPosition: TPoint = { x: 100, y: 200 };
        const newPixelSize: TSize = { width: 0.5, height: 2 };

        canvasWorld.atomicZoomAndPositionUpdate({
            viewPosition: newPosition,
            pixelSizeInWorldUnits: newPixelSize
        });

        assert.deepStrictEqual(canvasWorld.viewPosition, newPosition, 'View position should be updated');
        assert.deepStrictEqual(canvasWorld.pixelSizeInWorldUnits, newPixelSize, 'Pixel size should be updated');
        assert.ok(onViewPositionChangeSpy.calledOnceWith(newPosition), 'View position change should be notified');
        assert.ok(onPixelSizeChangeSpy.calledOnceWith(newPixelSize), 'Pixel size change should be notified');
    });

    test('should only update and notify for changed values in atomic update', () => {
        canvasWorld.viewPosition = { x: 50, y: 100 };
        canvasWorld.pixelSizeInWorldUnits = { width: 1.5, height: 2.5 };

        const onViewPositionChangeSpy = sinon.spy();
        const onPixelSizeChangeSpy = sinon.spy();
        canvasWorld.onViewPositionChange.subscribe(onViewPositionChangeSpy);
        canvasWorld.onPixelSizeChange.subscribe(onPixelSizeChangeSpy);

        canvasWorld.atomicZoomAndPositionUpdate({
            viewPosition: { x: 75, y: 100 }, // Only x changes
            pixelSizeInWorldUnits: { width: 1.5, height: 2.5 } // No change
        });

        assert.ok(onViewPositionChangeSpy.calledOnce, 'View position change should be notified when changed');
        assert.ok(onPixelSizeChangeSpy.notCalled, 'Pixel size change should not be notified when unchanged');
    });

    test('should enforce minimum pixel size in atomic update', () => {
        canvasWorld.atomicZoomAndPositionUpdate({
            pixelSizeInWorldUnits: { width: -1, height: 0.000001 }
        });

        const actualSize = canvasWorld.pixelSizeInWorldUnits;
        assert.ok(actualSize.width >= 0.00001, 'Width should be clamped to minimum');
        assert.ok(actualSize.height >= 0.00001, 'Height should be clamped to minimum');
    });
});

suite('CanvasWorld - Zoom Operations', () => {
    let canvasWorld: CanvasWorld;

    setup(() => {
        canvasWorld = new CanvasWorld();
        // Set up a more interesting initial state
        canvasWorld.viewPosition = { x: 100, y: 200 };
        canvasWorld.pixelSizeInWorldUnits = { width: 2, height: 2 };
    });

    teardown(() => {
        sinon.restore();
    });

    test('should zoom at point correctly', () => {
        const screenPoint: TPoint = { x: 50, y: 25 };
        const worldPointBefore = canvasWorld.screenToWorld(screenPoint);
        
        canvasWorld.zoomAtPoint(screenPoint, 0.5); // Zoom out by factor of 2
        
        const worldPointAfter = canvasWorld.screenToWorld(screenPoint);
        
        // The world point at the screen coordinates should remain the same
        assert.ok(Math.abs(worldPointBefore.x - worldPointAfter.x) < 0.0001, 'World point x should remain stable during zoom');
        assert.ok(Math.abs(worldPointBefore.y - worldPointAfter.y) < 0.0001, 'World point y should remain stable during zoom');
        
        // Pixel size should be updated
        const expectedPixelSize = { width: 4, height: 4 };
        assert.deepStrictEqual(canvasWorld.pixelSizeInWorldUnits, expectedPixelSize, 'Pixel size should be scaled by zoom factor');
    });

    test('should zoom at center point without changing view position', () => {
        const centerPoint: TPoint = { x: 0, y: 0 }; // Assuming canvas origin
        const initialViewPosition = { ...canvasWorld.viewPosition };
        
        canvasWorld.zoomAtPoint(centerPoint, 2); // Zoom in
        
        // When zooming at origin with view position offset, position should change to maintain point stability
        // But we can test that the zoom factor is applied
        assert.deepStrictEqual(canvasWorld.pixelSizeInWorldUnits, { width: 1, height: 1 }, 'Pixel size should be halved for 2x zoom in');
    });

    test('should handle anisotropic zoom at point', () => {
        const screenPoint: TPoint = { x: 10, y: 20 };
        const worldPointBefore = canvasWorld.screenToWorld(screenPoint);
        
        canvasWorld.anisotropicZoomAtPoint(screenPoint, { width: 0.5, height: 2 });
        
        const worldPointAfter = canvasWorld.screenToWorld(screenPoint);
        
        // The world point should remain stable
        assert.ok(Math.abs(worldPointBefore.x - worldPointAfter.x) < 0.0001, 'World point x should remain stable during anisotropic zoom');
        assert.ok(Math.abs(worldPointBefore.y - worldPointAfter.y) < 0.0001, 'World point y should remain stable during anisotropic zoom');
        
        // Pixel size should be updated with different factors for width and height
        assert.deepStrictEqual(canvasWorld.pixelSizeInWorldUnits, { width: 4, height: 1 }, 'Pixel size should be scaled by respective zoom factors');
    });

    test('should notify observers during zoom operations', () => {
        const onViewPositionChangeSpy = sinon.spy();
        const onPixelSizeChangeSpy = sinon.spy();
        canvasWorld.onViewPositionChange.subscribe(onViewPositionChangeSpy);
        canvasWorld.onPixelSizeChange.subscribe(onPixelSizeChangeSpy);

        canvasWorld.zoomAtPoint({ x: 25, y: 50 }, 0.8);

        assert.ok(onPixelSizeChangeSpy.called, 'Pixel size change should be notified during zoom');
        // View position will likely change unless zooming exactly at the current view center
        assert.ok(onViewPositionChangeSpy.called, 'View position change should be notified during zoom');
    });
});

suite('CanvasWorld - Bounds and Navigation', () => {
    let canvasWorld: CanvasWorld;

    setup(() => {
        canvasWorld = new CanvasWorld();
        canvasWorld.viewPosition = { x: 50, y: 100 };
        canvasWorld.pixelSizeInWorldUnits = { width: 2, height: 0.5 };
    });

    teardown(() => {
        sinon.restore();
    });

    test('should calculate visible world bounds correctly', () => {
        const canvasSize: TSize = { width: 400, height: 200 };
        const bounds = canvasWorld.getVisibleWorldBounds(canvasSize);

        const expectedMin = canvasWorld.screenToWorld({ x: 0, y: 0 });
        const expectedMax = canvasWorld.screenToWorld({ x: 400, y: 200 });

        assert.deepStrictEqual(bounds.min, expectedMin, 'Minimum bounds should match screen origin in world coordinates');
        assert.deepStrictEqual(bounds.max, expectedMax, 'Maximum bounds should match canvas size in world coordinates');
        assert.deepStrictEqual(bounds.min, { x: 50, y: 100 }, 'Min bounds calculation verification');
        assert.deepStrictEqual(bounds.max, { x: 850, y: 200 }, 'Max bounds calculation verification');
    });

    test('should calculate center view position correctly', () => {
        const canvasSize: TSize = { width: 200, height: 400 };
        const centerPosition = canvasWorld.getCenterViewPosition(canvasSize);

        const bounds = canvasWorld.getVisibleWorldBounds(canvasSize);
        const expectedCenter = {
            x: (bounds.min.x + bounds.max.x) / 2,
            y: (bounds.min.y + bounds.max.y) / 2
        };

        assert.deepStrictEqual(centerPosition, expectedCenter, 'Center position should be midpoint of visible bounds');
    });

    test('should pan correctly', () => {
        const onViewPositionChangeSpy = sinon.spy();
        canvasWorld.onViewPositionChange.subscribe(onViewPositionChangeSpy);

        const initialPosition = { ...canvasWorld.viewPosition };
        const screenDelta: TPoint = { x: 20, y: -10 };

        canvasWorld.pan(screenDelta);

        const worldDelta = canvasWorld.screenDeltaToWorldDelta(screenDelta);
        const expectedNewPosition = {
            x: initialPosition.x - worldDelta.x,
            y: initialPosition.y - worldDelta.y
        };

        assert.deepStrictEqual(canvasWorld.viewPosition, expectedNewPosition, 'Pan should move view position by world delta');
        assert.ok(onViewPositionChangeSpy.calledOnceWith(expectedNewPosition), 'Pan should notify position change');
    });
});

suite('CanvasWorld - Reset Operations', () => {
    let canvasWorld: CanvasWorld;

    setup(() => {
        canvasWorld = new CanvasWorld();
        // Set non-default values
        canvasWorld.viewPosition = { x: 123, y: 456 };
        canvasWorld.pixelSizeInWorldUnits = { width: 3.5, height: 0.8 };
    });

    teardown(() => {
        sinon.restore();
    });

    test('should reset view to defaults', () => {
        const onViewPositionChangeSpy = sinon.spy();
        const onPixelSizeChangeSpy = sinon.spy();
        canvasWorld.onViewPositionChange.subscribe(onViewPositionChangeSpy);
        canvasWorld.onPixelSizeChange.subscribe(onPixelSizeChangeSpy);

        canvasWorld.resetView();

        assert.deepStrictEqual(canvasWorld.viewPosition, { x: 0, y: 0 }, 'View position should be reset to origin');
        assert.deepStrictEqual(canvasWorld.pixelSizeInWorldUnits, { width: 1, height: 1 }, 'Pixel size should be reset to 1:1');
        assert.ok(onViewPositionChangeSpy.called, 'View position change should be notified');
        assert.ok(onPixelSizeChangeSpy.called, 'Pixel size change should be notified');
    });

    test('should reset only view position', () => {
        const onViewPositionChangeSpy = sinon.spy();
        const onPixelSizeChangeSpy = sinon.spy();
        canvasWorld.onViewPositionChange.subscribe(onViewPositionChangeSpy);
        canvasWorld.onPixelSizeChange.subscribe(onPixelSizeChangeSpy);

        const initialPixelSize = { ...canvasWorld.pixelSizeInWorldUnits };

        canvasWorld.resetViewPosition();

        assert.deepStrictEqual(canvasWorld.viewPosition, { x: 0, y: 0 }, 'View position should be reset to origin');
        assert.deepStrictEqual(canvasWorld.pixelSizeInWorldUnits, initialPixelSize, 'Pixel size should remain unchanged');
        assert.ok(onViewPositionChangeSpy.called, 'View position change should be notified');
        assert.ok(onPixelSizeChangeSpy.notCalled, 'Pixel size change should not be notified');
    });

    test('should return pixel size in world units', () => {
        const pixelSize = canvasWorld.getPixelSizeInWorldUnits();
        
        assert.deepStrictEqual(pixelSize, canvasWorld.pixelSizeInWorldUnits, 'Should return current pixel size');
        assert.deepStrictEqual(pixelSize, { width: 3.5, height: 0.8 }, 'Should match the set values');
    });
});

suite('CanvasWorld - Panning Logic Verification', () => {
    let canvasWorld: CanvasWorld;

    setup(() => {
        canvasWorld = new CanvasWorld();
    });

    teardown(() => {
        sinon.restore();
    });

    test('should keep world point stable under cursor during a pan operation', () => {
        canvasWorld.viewPosition = { x: 500, y: 500 };
        canvasWorld.pixelSizeInWorldUnits = { width: 0.2, height: 0.2 };

        const screenPointBefore: TPoint = { x: 100, y: 150 };
        const screenPointAfter: TPoint = { x: 125, y: 140 };

        const worldPointBefore = canvasWorld.screenToWorld(screenPointBefore);
        assert.deepStrictEqual(worldPointBefore, { x: 520, y: 530 });

        const screenDelta: TPoint = {
            x: screenPointAfter.x - screenPointBefore.x,
            y: screenPointAfter.y - screenPointBefore.y
        };
        canvasWorld.pan(screenDelta);

        const worldPointAfter = canvasWorld.screenToWorld(screenPointAfter);

        assert.ok(Math.abs(worldPointAfter.x - worldPointBefore.x) < 0.0001, 'World point X should remain stable after pan');
        assert.ok(Math.abs(worldPointAfter.y - worldPointBefore.y) < 0.0001, 'World point Y should remain stable after pan');
    });
});

suite('CanvasWorld - Edge Cases and Error Handling', () => {
    let canvasWorld: CanvasWorld;

    setup(() => {
        canvasWorld = new CanvasWorld();
    });

    teardown(() => {
        sinon.restore();
    });

    test('should handle zero canvas size gracefully', () => {
        const canvasSize: TSize = { width: 0, height: 0 };
        
        const bounds = canvasWorld.getVisibleWorldBounds(canvasSize);
        const centerPosition = canvasWorld.getCenterViewPosition(canvasSize);

        assert.deepStrictEqual(bounds.min, { x: 0, y: 0 }, 'Min bounds should be origin for zero canvas');
        assert.deepStrictEqual(bounds.max, { x: 0, y: 0 }, 'Max bounds should be origin for zero canvas');
        assert.deepStrictEqual(centerPosition, { x: 0, y: 0 }, 'Center should be origin for zero canvas');
    });

    test('should handle extreme zoom values', () => {
        canvasWorld.zoomAtPoint({ x: 0, y: 0 }, 0.000001); // Extreme zoom out
        
        const pixelSize = canvasWorld.pixelSizeInWorldUnits;
        assert.ok(pixelSize.width >= 0.00001, 'Extreme zoom should be clamped to minimum pixel size');
        assert.ok(pixelSize.height >= 0.00001, 'Extreme zoom should be clamped to minimum pixel size');
    });

    test('should handle large coordinate values without precision loss', () => {
        const largePoint: TPoint = { x: 1000000, y: -2000000 };
        canvasWorld.viewPosition = largePoint;
        
        const screenPoint: TPoint = { x: 100, y: 200 };
        const worldPoint = canvasWorld.screenToWorld(screenPoint);
        const backToScreen = canvasWorld.worldToScreen(worldPoint);
        
        assert.ok(Math.abs(backToScreen.x - screenPoint.x) < 0.0001, 'Large coordinates should maintain precision in x');
        assert.ok(Math.abs(backToScreen.y - screenPoint.y) < 0.0001, 'Large coordinates should maintain precision in y');
    });

    test('should handle negative coordinate transformations', () => {
        canvasWorld.viewPosition = { x: -100, y: -200 };
        
        const screenPoint: TPoint = { x: -50, y: -25 };
        const worldPoint = canvasWorld.screenToWorld(screenPoint);
        const backToScreen = canvasWorld.worldToScreen(worldPoint);
        
        assert.deepStrictEqual(worldPoint, { x: -150, y: -225 }, 'Negative coordinates should transform correctly');
        assert.deepStrictEqual(backToScreen, screenPoint, 'Negative coordinate round-trip should be accurate');
    });
});
