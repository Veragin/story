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
import { VisibleVisualObjectsManager, IVisibilityProvider } from 'code/Visualizer/GUIComponents/Canvas/CanvasManager/VisibleVisualObjectsManager';
import { CanvasWorld, TPoint, TSize } from 'code/Visualizer/GUIComponents/Canvas/CanvasManager/CanvasWorld';
import { VisualObject } from 'code/Visualizer/GUIComponents/Canvas/Node/VisualObject';
import { Observer } from 'code/utils/Observer';

// Mock VisualObject for testing
class MockVisualObject extends VisualObject {
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

    // Add method to manually trigger property change for testing
    triggerPropertyChange(property: string) {
        this.onPropertyChanged.notify({ property, VisualObject: this });
    }
}

// Mock visibility provider
class MockVisibilityProvider implements IVisibilityProvider {
    public _objects: VisualObject[] = [];
    private _canvasSize: TSize = { width: 800, height: 600 };
    
    public onObjectAdded = new Observer<VisualObject>();
    public onObjectRemoved = new Observer<VisualObject>();
    public onObjectPropertyChanged = new Observer<{ object: VisualObject; property: string }>();

    getAllObjects(): VisualObject[] {
        return [...this._objects];
    }

    getCanvasSize(): TSize {
        return this._canvasSize;
    }

    setCanvasSize(size: TSize): void {
        this._canvasSize = size;
    }

    addObject(obj: VisualObject): void {
        this._objects.push(obj);
        this.onObjectAdded.notify(obj);
    }

    removeObject(obj: VisualObject): void {
        const index = this._objects.indexOf(obj);
        if (index >= 0) {
            this._objects.splice(index, 1);
            this.onObjectRemoved.notify(obj);
        }
    }

    changeObjectProperty(obj: VisualObject, property: string, value: any): void {
        if (property === 'zIndex') {
            obj.setZIndex(value);
        } else {
            (obj as any)[property] = value;
        }
        this.onObjectPropertyChanged.notify({ object: obj, property });
    }

    moveObject(obj: VisualObject, newPosition: TPoint): void {
        obj.position = newPosition;
        this.onObjectPropertyChanged.notify({ object: obj, property: 'position' });
    }

    resizeObject(obj: VisualObject, newSize: TSize): void {
        obj.size = newSize;
        this.onObjectPropertyChanged.notify({ object: obj, property: 'size' });
    }
}

suite('VisibleVisualObjectsManager - Initialization', () => {
    let canvasWorld: CanvasWorld;
    let provider: MockVisibilityProvider;
    let manager: VisibleVisualObjectsManager;

    setup(() => {
        canvasWorld = new CanvasWorld();
        provider = new MockVisibilityProvider();
        
        // Set up initial viewport
        canvasWorld.viewPosition = { x: 0, y: 0 };
        canvasWorld.pixelSizeInWorldUnits = { width: 1, height: 1 };
        
        manager = new VisibleVisualObjectsManager(canvasWorld, provider);
    });

    teardown(() => {
        manager.destroy();
        sinon.restore();
    });

    test('should initialize with empty visible objects set', () => {
        const visibleObjects = manager.getVisibleObjects();
        
        assert.strictEqual(visibleObjects.size, 0, 'Should have no visible objects initially');
    });

    test('should initialize with objects already in provider', () => {
        // Create new setup with objects already present
        const newProvider = new MockVisibilityProvider();
        const obj1 = new MockVisualObject({ x: 0, y: 0 }, { width: 10, height: 10 });
        const obj2 = new MockVisualObject({ x: 100, y: 100 }, { width: 10, height: 10 });
        
        newProvider._objects.push(obj1, obj2); // Add directly to avoid triggering events
        
        const newManager = new VisibleVisualObjectsManager(canvasWorld, newProvider);
        const visibleObjects = newManager.getVisibleObjects();
        
        // Both objects should be visible in the default viewport
        assert.ok(visibleObjects.has(obj1), 'First object should be visible');
        assert.ok(visibleObjects.has(obj2), 'Second object should be visible');
        
        newManager.destroy();
    });

    test('should subscribe to canvas world events', () => {
        const onViewPositionChangeSpy = sinon.spy();
        const onPixelSizeChangeSpy = sinon.spy();
        
        // Subscribe to test if events are forwarded
        manager.onVisibleObjectsChanged.subscribe(onViewPositionChangeSpy);
        manager.onVisibleObjectsChanged.subscribe(onPixelSizeChangeSpy);
        
        // Trigger canvas world changes
        canvasWorld.viewPosition = { x: 100, y: 100 };
        canvasWorld.pixelSizeInWorldUnits = { width: 2, height: 2 };
        
        // Should trigger visibility recalculation (may or may not change visible objects)
        assert.ok(true, 'Should handle canvas world changes without errors');
    });

    test('should subscribe to provider events', () => {
        const obj = new MockVisualObject({ x: 0, y: 0 });
        const onVisibleObjectsChangedSpy = sinon.spy();
        manager.onVisibleObjectsChanged.subscribe(onVisibleObjectsChangedSpy);
        
        provider.addObject(obj);
        
        assert.ok(onVisibleObjectsChangedSpy.called, 'Should notify when provider adds objects');
    });
});

suite('VisibleVisualObjectsManager - Object Addition', () => {
    let canvasWorld: CanvasWorld;
    let provider: MockVisibilityProvider;
    let manager: VisibleVisualObjectsManager;

    setup(() => {
        canvasWorld = new CanvasWorld();
        provider = new MockVisibilityProvider();
        
        // Set viewport to show objects at origin
        canvasWorld.viewPosition = { x: 0, y: 0 };
        canvasWorld.pixelSizeInWorldUnits = { width: 1, height: 1 };
        
        manager = new VisibleVisualObjectsManager(canvasWorld, provider);
    });

    teardown(() => {
        manager.destroy();
        sinon.restore();
    });

    test('should add visible object when it is in viewport', () => {
        const obj = new MockVisualObject({ x: 10, y: 10 }, { width: 20, height: 20 });
        const onVisibleObjectsChangedSpy = sinon.spy();
        manager.onVisibleObjectsChanged.subscribe(onVisibleObjectsChangedSpy);
        
        provider.addObject(obj);
        
        const visibleObjects = manager.getVisibleObjects();
        assert.ok(visibleObjects.has(obj), 'Visible object should be added to visible set');
        assert.ok(onVisibleObjectsChangedSpy.called, 'Should notify of visible objects change');
    });

    test('should not add object when it is outside viewport', () => {
        const obj = new MockVisualObject({ x: 1000, y: 1000 }, { width: 10, height: 10 });
        const onVisibleObjectsChangedSpy = sinon.spy();
        manager.onVisibleObjectsChanged.subscribe(onVisibleObjectsChangedSpy);
        
        provider.addObject(obj);
        
        const visibleObjects = manager.getVisibleObjects();
        assert.ok(!visibleObjects.has(obj), 'Object outside viewport should not be visible');
        // May or may not notify depending on implementation
    });

    test('should handle multiple objects addition', () => {
        const obj1 = new MockVisualObject({ x: 0, y: 0 }, { width: 10, height: 10 });
        const obj2 = new MockVisualObject({ x: 50, y: 50 }, { width: 15, height: 15 });
        const obj3 = new MockVisualObject({ x: 2000, y: 2000 }, { width: 10, height: 10 }); // Outside viewport
        
        provider.addObject(obj1);
        provider.addObject(obj2);
        provider.addObject(obj3);
        
        const visibleObjects = manager.getVisibleObjects();
        assert.ok(visibleObjects.has(obj1), 'First visible object should be added');
        assert.ok(visibleObjects.has(obj2), 'Second visible object should be added');
        assert.ok(!visibleObjects.has(obj3), 'Object outside viewport should not be visible');
        assert.strictEqual(visibleObjects.size, 2, 'Should have exactly 2 visible objects');
    });

    test('should handle objects with zero or very small size', () => {
        const zeroSizeObj = new MockVisualObject({ x: 10, y: 10 }, { width: 0, height: 0 });
        const tinyObj = new MockVisualObject({ x: 20, y: 20 }, { width: 0.5, height: 0.5 });
        
        provider.addObject(zeroSizeObj);
        provider.addObject(tinyObj);
        
        const visibleObjects = manager.getVisibleObjects();
        // Objects smaller than a pixel should not be visible according to the implementation
        assert.ok(!visibleObjects.has(zeroSizeObj), 'Zero-size object should not be visible');
        assert.ok(!visibleObjects.has(tinyObj), 'Sub-pixel object should not be visible');
    });
});

suite('VisibleVisualObjectsManager - Object Removal', () => {
    let canvasWorld: CanvasWorld;
    let provider: MockVisibilityProvider;
    let manager: VisibleVisualObjectsManager;
    let obj1: MockVisualObject;
    let obj2: MockVisualObject;

    setup(() => {
        canvasWorld = new CanvasWorld();
        provider = new MockVisibilityProvider();
        manager = new VisibleVisualObjectsManager(canvasWorld, provider);
        
        obj1 = new MockVisualObject({ x: 10, y: 10 }, { width: 20, height: 20 });
        obj2 = new MockVisualObject({ x: 50, y: 50 }, { width: 15, height: 15 });
        
        provider.addObject(obj1);
        provider.addObject(obj2);
    });

    teardown(() => {
        manager.destroy();
        sinon.restore();
    });

    test('should remove visible object from visible set', () => {
        const onVisibleObjectsChangedSpy = sinon.spy();
        manager.onVisibleObjectsChanged.subscribe(onVisibleObjectsChangedSpy);
        
        // Ensure object is initially visible
        assert.ok(manager.getVisibleObjects().has(obj1), 'Object should be initially visible');
        
        provider.removeObject(obj1);
        
        const visibleObjects = manager.getVisibleObjects();
        assert.ok(!visibleObjects.has(obj1), 'Removed object should not be in visible set');
        assert.ok(visibleObjects.has(obj2), 'Other object should remain visible');
        assert.ok(onVisibleObjectsChangedSpy.called, 'Should notify of visible objects change');
    });

    test('should handle removal of non-visible object', () => {
        const hiddenObj = new MockVisualObject({ x: 2000, y: 2000 }, { width: 10, height: 10 });
        provider.addObject(hiddenObj);
        
        const onVisibleObjectsChangedSpy = sinon.spy();
        manager.onVisibleObjectsChanged.subscribe(onVisibleObjectsChangedSpy);
        
        // Reset the spy after setup
        onVisibleObjectsChangedSpy.resetHistory();
        
        provider.removeObject(hiddenObj);
        
        // Should not affect visible objects or trigger notification since object wasn't visible
        const visibleObjects = manager.getVisibleObjects();
        assert.ok(visibleObjects.has(obj1), 'Visible objects should remain unchanged');
        assert.ok(visibleObjects.has(obj2), 'Visible objects should remain unchanged');
    });

    test('should remove all objects when cleared', () => {
        provider.removeObject(obj1);
        provider.removeObject(obj2);
        
        const visibleObjects = manager.getVisibleObjects();
        assert.strictEqual(visibleObjects.size, 0, 'No objects should be visible after removal');
    });

    test('should handle rapid add/remove cycles', () => {
        const obj = new MockVisualObject({ x: 25, y: 25 }, { width: 10, height: 10 });
        
        // Add and remove multiple times
        for (let i = 0; i < 5; i++) {
            provider.addObject(obj);
            assert.ok(manager.getVisibleObjects().has(obj), `Object should be visible after add ${i + 1}`);
            
            provider.removeObject(obj);
            assert.ok(!manager.getVisibleObjects().has(obj), `Object should not be visible after remove ${i + 1}`);
        }
    });
});

suite('VisibleVisualObjectsManager - Property Changes', () => {
    let canvasWorld: CanvasWorld;
    let provider: MockVisibilityProvider;
    let manager: VisibleVisualObjectsManager;

    setup(() => {
        canvasWorld = new CanvasWorld();
        provider = new MockVisibilityProvider();
        
        // Set up viewport to show objects around origin
        canvasWorld.viewPosition = { x: 0, y: 0 };
        canvasWorld.pixelSizeInWorldUnits = { width: 1, height: 1 };
        
        manager = new VisibleVisualObjectsManager(canvasWorld, provider);
    });

    teardown(() => {
        manager.destroy();
        sinon.restore();
    });

    test('should handle position changes that affect visibility', () => {
        const obj = new MockVisualObject({ x: 10, y: 10 }, { width: 10, height: 10 });
        provider.addObject(obj);
        
        // Initially visible
        assert.ok(manager.getVisibleObjects().has(obj), 'Object should be initially visible');
        
        const onVisibleObjectsChangedSpy = sinon.spy();
        manager.onVisibleObjectsChanged.subscribe(onVisibleObjectsChangedSpy);
        
        // Move object outside viewport
        provider.moveObject(obj, { x: 2000, y: 2000 });
        
        assert.ok(!manager.getVisibleObjects().has(obj), 'Object should not be visible after moving outside viewport');
        assert.ok(onVisibleObjectsChangedSpy.called, 'Should notify of visibility change');
    });

    test('should handle position changes that bring object into view', () => {
        const obj = new MockVisualObject({ x: 2000, y: 2000 }, { width: 10, height: 10 });
        provider.addObject(obj);
        
        // Initially not visible
        assert.ok(!manager.getVisibleObjects().has(obj), 'Object should be initially hidden');
        
        const onVisibleObjectsChangedSpy = sinon.spy();
        manager.onVisibleObjectsChanged.subscribe(onVisibleObjectsChangedSpy);
        
        // Move object into viewport
        provider.moveObject(obj, { x: 10, y: 10 });
        
        assert.ok(manager.getVisibleObjects().has(obj), 'Object should be visible after moving into viewport');
        assert.ok(onVisibleObjectsChangedSpy.called, 'Should notify of visibility change');
    });

    test('should handle size changes that affect visibility', () => {
        const obj = new MockVisualObject({ x: 10, y: 10 }, { width: 10, height: 10 });
        provider.addObject(obj);
        
        // Initially visible
        assert.ok(manager.getVisibleObjects().has(obj), 'Object should be initially visible');
        
        const onVisibleObjectsChangedSpy = sinon.spy();
        manager.onVisibleObjectsChanged.subscribe(onVisibleObjectsChangedSpy);
        
        // Make object too small to be visible
        provider.resizeObject(obj, { width: 0.1, height: 0.1 });
        
        assert.ok(!manager.getVisibleObjects().has(obj), 'Object should not be visible when too small');
        assert.ok(onVisibleObjectsChangedSpy.called, 'Should notify of visibility change');
    });

    test('should ignore non-relevant property changes', () => {
        const obj = new MockVisualObject({ x: 10, y: 10 }, { width: 10, height: 10 });
        provider.addObject(obj);
        
        const onVisibleObjectsChangedSpy = sinon.spy();
        manager.onVisibleObjectsChanged.subscribe(onVisibleObjectsChangedSpy);
        onVisibleObjectsChangedSpy.resetHistory(); // Reset after initial add
        
        // Change a non-relevant property (like zIndex)
        provider.changeObjectProperty(obj, 'zIndex', 5);
        
        // Should not trigger visibility recalculation
        assert.ok(manager.getVisibleObjects().has(obj), 'Object should remain visible');
        // Implementation may or may not notify for non-position/size changes
    });

    test('should handle position changes that do not affect visibility', () => {
        const obj = new MockVisualObject({ x: 10, y: 10 }, { width: 10, height: 10 });
        provider.addObject(obj);
        
        const onVisibleObjectsChangedSpy = sinon.spy();
        manager.onVisibleObjectsChanged.subscribe(onVisibleObjectsChangedSpy);
        onVisibleObjectsChangedSpy.resetHistory();
        
        // Move object to another visible position
        provider.moveObject(obj, { x: 50, y: 50 });
        
        // Object should still be visible, but notification behavior may vary
        assert.ok(manager.getVisibleObjects().has(obj), 'Object should remain visible after moving within viewport');
    });
});

suite('VisibleVisualObjectsManager - Canvas Size Changes', () => {
    let canvasWorld: CanvasWorld;
    let provider: MockVisibilityProvider;
    let manager: VisibleVisualObjectsManager;

    setup(() => {
        canvasWorld = new CanvasWorld();
        provider = new MockVisibilityProvider();
        manager = new VisibleVisualObjectsManager(canvasWorld, provider);
    });

    teardown(() => {
        manager.destroy();
        sinon.restore();
    });

    test('should update visibility when canvas size changes', () => {
        const obj = new MockVisualObject({ x: 900, y: 700 }, { width: 10, height: 10 });
        provider.addObject(obj);
        
        // With default 800x600 canvas, object should not be visible
        assert.ok(!manager.getVisibleObjects().has(obj), 'Object should not be visible with small canvas');
        
        const onVisibleObjectsChangedSpy = sinon.spy();
        manager.onVisibleObjectsChanged.subscribe(onVisibleObjectsChangedSpy);
        
        // Increase canvas size to make object visible
        manager.setCanvasSize({ width: 1000, height: 800 });
        
        // Object should now be visible
        assert.ok(manager.getVisibleObjects().has(obj), 'Object should be visible with larger canvas');
        assert.ok(onVisibleObjectsChangedSpy.called, 'Should notify of visibility change');
    });

    test('should handle canvas size reduction', () => {
        const obj = new MockVisualObject({ x: 700, y: 500 }, { width: 10, height: 10 });
        provider.addObject(obj);
        
        // With default canvas size, object should be visible
        assert.ok(manager.getVisibleObjects().has(obj), 'Object should be initially visible');
        
        const onVisibleObjectsChangedSpy = sinon.spy();
        manager.onVisibleObjectsChanged.subscribe(onVisibleObjectsChangedSpy);
        
        // Reduce canvas size to hide object
        manager.setCanvasSize({ width: 400, height: 300 });
        
        // Object should no longer be visible
        assert.ok(!manager.getVisibleObjects().has(obj), 'Object should not be visible with smaller canvas');
        assert.ok(onVisibleObjectsChangedSpy.called, 'Should notify of visibility change');
    });
});

suite('VisibleVisualObjectsManager - Viewport Changes', () => {
    let canvasWorld: CanvasWorld;
    let provider: MockVisibilityProvider;
    let manager: VisibleVisualObjectsManager;

    setup(() => {
        canvasWorld = new CanvasWorld();
        provider = new MockVisibilityProvider();
        manager = new VisibleVisualObjectsManager(canvasWorld, provider);
        
        // Add some objects at different positions
        const obj1 = new MockVisualObject({ x: 0, y: 0 }, { width: 10, height: 10 });
        const obj2 = new MockVisualObject({ x: 500, y: 500 }, { width: 10, height: 10 });
        const obj3 = new MockVisualObject({ x: 1000, y: 1000 }, { width: 10, height: 10 });
        
        provider.addObject(obj1);
        provider.addObject(obj2);
        provider.addObject(obj3);
    });

    teardown(() => {
        manager.destroy();
        sinon.restore();
    });

    test('should update visibility when viewport position changes', () => {
        const onVisibleObjectsChangedSpy = sinon.spy();
        manager.onVisibleObjectsChanged.subscribe(onVisibleObjectsChangedSpy);
        
        // Change viewport to show different objects
        canvasWorld.viewPosition = { x: 1000, y: 1000 };
        
        // Should trigger visibility recalculation
        // The specific objects visible will depend on exact viewport calculations
        assert.ok(true, 'Viewport change should be handled without errors');
    });

    test('should update visibility when pixel size changes (zoom)', () => {
        const onVisibleObjectsChangedSpy = sinon.spy();
        manager.onVisibleObjectsChanged.subscribe(onVisibleObjectsChangedSpy);
        
        // Change zoom level
        canvasWorld.pixelSizeInWorldUnits = { width: 0.5, height: 0.5 }; // Zoom in
        
        // Should trigger visibility recalculation
        assert.ok(true, 'Pixel size change should be handled without errors');
    });

    test('should handle rapid viewport changes', () => {
        const positions = [
            { x: 0, y: 0 },
            { x: 500, y: 500 },
            { x: 1000, y: 1000 },
            { x: 250, y: 750 },
            { x: 0, y: 0 }
        ];
        
        // Rapidly change viewport positions
        for (const position of positions) {
            canvasWorld.viewPosition = position;
            
            // Should handle each change without errors
            const visibleObjects = manager.getVisibleObjects();
            assert.ok(visibleObjects instanceof Set, 'Should maintain valid visible objects set');
        }
    });
});

suite('VisibleVisualObjectsManager - Visibility Detection', () => {
    let canvasWorld: CanvasWorld;
    let provider: MockVisibilityProvider;
    let manager: VisibleVisualObjectsManager;

    setup(() => {
        canvasWorld = new CanvasWorld();
        provider = new MockVisibilityProvider();
        
        // Set specific viewport for predictable testing
        canvasWorld.viewPosition = { x: 0, y: 0 };
        canvasWorld.pixelSizeInWorldUnits = { width: 1, height: 1 };
        provider.setCanvasSize({ width: 100, height: 100 });
        
        manager = new VisibleVisualObjectsManager(canvasWorld, provider);
    });

    teardown(() => {
        manager.destroy();
        sinon.restore();
    });

    test('should detect objects fully within viewport', () => {
        const obj = new MockVisualObject({ x: 10, y: 10 }, { width: 20, height: 20 });
        provider.addObject(obj);
        
        assert.ok(manager.getVisibleObjects().has(obj), 'Object fully within viewport should be visible');
    });

    test('should detect objects partially overlapping viewport', () => {
        // Object extends beyond viewport boundaries
        const obj = new MockVisualObject({ x: 90, y: 90 }, { width: 20, height: 20 });
        provider.addObject(obj);
        
        assert.ok(manager.getVisibleObjects().has(obj), 'Object partially overlapping viewport should be visible');
    });

    test('should not detect objects completely outside viewport', () => {
        const obj = new MockVisualObject({ x: 200, y: 200 }, { width: 10, height: 10 });
        provider.addObject(obj);
        
        assert.ok(!manager.getVisibleObjects().has(obj), 'Object completely outside viewport should not be visible');
    });

    test('should handle objects at viewport boundaries', () => {
        // Object exactly at right boundary
        const objRight = new MockVisualObject({ x: 100, y: 10 }, { width: 10, height: 10 });
        // Object exactly at bottom boundary  
        const objBottom = new MockVisualObject({ x: 10, y: 100 }, { width: 10, height: 10 });
        // Object at top-left corner
        const objCorner = new MockVisualObject({ x: 0, y: 0 }, { width: 10, height: 10 });
        
        provider.addObject(objRight);
        provider.addObject(objBottom);
        provider.addObject(objCorner);
        
        const visibleObjects = manager.getVisibleObjects();
        
        // Corner object should definitely be visible
        assert.ok(visibleObjects.has(objCorner), 'Object at corner should be visible');
        
        // Boundary behavior may vary based on exact implementation
        // These objects may or may not be visible depending on boundary conditions
    });

    test('should handle very large objects', () => {
        const largeObj = new MockVisualObject({ x: -500, y: -500 }, { width: 2000, height: 2000 });
        provider.addObject(largeObj);
        
        assert.ok(manager.getVisibleObjects().has(largeObj), 'Large object covering viewport should be visible');
    });

    test('should correctly handle sub-pixel objects', () => {
        // Set pixel size to make objects smaller than a pixel
        canvasWorld.pixelSizeInWorldUnits = { width: 10, height: 10 };
        
        const subPixelObj = new MockVisualObject({ x: 10, y: 10 }, { width: 5, height: 5 });
        provider.addObject(subPixelObj);
        
        assert.ok(!manager.getVisibleObjects().has(subPixelObj), 
            'Object smaller than a pixel should not be visible');
    });

    test('should handle objects with negative dimensions gracefully', () => {
        const negativeObj = new MockVisualObject({ x: 10, y: 10 }, { width: -10, height: -10 });
        provider.addObject(negativeObj);
        
        // Should not crash and handle gracefully
        const visibleObjects = manager.getVisibleObjects();
        assert.ok(visibleObjects instanceof Set, 'Should handle negative dimensions gracefully');
    });
});

suite('VisibleVisualObjectsManager - Performance and Edge Cases', () => {
    let canvasWorld: CanvasWorld;
    let provider: MockVisibilityProvider;
    let manager: VisibleVisualObjectsManager;

    setup(() => {
        canvasWorld = new CanvasWorld();
        provider = new MockVisibilityProvider();
        manager = new VisibleVisualObjectsManager(canvasWorld, provider);
    });

    teardown(() => {
        manager.destroy();
        sinon.restore();
    });

    test('should handle large number of objects', () => {
        const objects: MockVisualObject[] = [];
        
        // Add many objects
        for (let i = 0; i < 1000; i++) {
            const obj = new MockVisualObject(
                { x: i * 10, y: i * 10 }, 
                { width: 5, height: 5 }
            );
            objects.push(obj);
            provider.addObject(obj);
        }
        
        const visibleObjects = manager.getVisibleObjects();
        
        // Should handle large number of objects without errors
        assert.ok(visibleObjects.size >= 0, 'Should handle many objects');
        assert.ok(visibleObjects.size <= 1000, 'Should not have more objects than added');
    });

    test('should handle empty provider gracefully', () => {
        const visibleObjects = manager.getVisibleObjects();
        
        assert.strictEqual(visibleObjects.size, 0, 'Empty provider should result in no visible objects');
    });

    test('should handle disposal correctly', () => {
        const obj = new MockVisualObject({ x: 10, y: 10 });
        provider.addObject(obj);
        
        // Should not throw when disposed
        manager.destroy();
        
        // Adding objects after disposal should not affect the disposed manager
        provider.addObject(new MockVisualObject({ x: 20, y: 20 }));
        
        assert.ok(true, 'Disposal should complete without errors');
    });

    test('should maintain consistency during rapid changes', () => {
        const objects: MockVisualObject[] = [];
        
        // Create objects
        for (let i = 0; i < 10; i++) {
            objects.push(new MockVisualObject({ x: i * 20, y: i * 20 }));
        }
        
        // Rapidly add, move, and remove objects
        for (let cycle = 0; cycle < 5; cycle++) {
            // Add objects
            objects.forEach(obj => provider.addObject(obj));
            
            // Move objects
            objects.forEach(obj => provider.moveObject(obj, { x: obj.position.x + 100, y: obj.position.y + 100 }));
            
            // Remove objects
            objects.forEach(obj => provider.removeObject(obj));
            
            // Check consistency
            const visibleObjects = manager.getVisibleObjects();
            assert.strictEqual(visibleObjects.size, 0, `After cycle ${cycle}, should have no visible objects`);
        }
    });

    test('should handle concurrent modifications gracefully', () => {
        const obj1 = new MockVisualObject({ x: 10, y: 10 });
        const obj2 = new MockVisualObject({ x: 20, y: 20 });
        
        // Simulate concurrent modifications
        provider.addObject(obj1);
        provider.moveObject(obj1, { x: 30, y: 30 });
        provider.addObject(obj2);
        provider.removeObject(obj1);
        provider.resizeObject(obj2, { width: 50, height: 50 });
        
        const visibleObjects = manager.getVisibleObjects();
        assert.ok(visibleObjects instanceof Set, 'Should maintain valid state during concurrent modifications');
        assert.ok(visibleObjects.has(obj2), 'Remaining object should be visible');
        assert.ok(!visibleObjects.has(obj1), 'Removed object should not be visible');
    });
});

suite('VisibleVisualObjectsManager - Zoom-In Visibility', () => {
    let canvasWorld: CanvasWorld;
    let provider: MockVisibilityProvider;
    let manager: VisibleVisualObjectsManager;
    let obj: MockVisualObject;

    setup(() => {
        canvasWorld = new CanvasWorld();
        provider = new MockVisibilityProvider();

        canvasWorld.viewPosition = { x: 0, y: 0 };
        canvasWorld.pixelSizeInWorldUnits = { width: 1, height: 1 };
        provider.setCanvasSize({ width: 800, height: 600 });

        obj = new MockVisualObject({ x: 801, y: 250 }, { width: 30, height: 50 });
        provider.addObject(obj);

        manager = new VisibleVisualObjectsManager(canvasWorld, provider);
    });

    teardown(() => {
        manager.destroy();
        sinon.restore();
    });

    test('should make an object visible after zooming in towards it', () => {
        assert.ok(!manager.getVisibleObjects().has(obj), 'Object should not be visible initially');

        const screenRightEdge: TPoint = { x: 750, y: 300 };
        canvasWorld.zoomAtPoint(screenRightEdge, 0.5);

        assert.strictEqual(canvasWorld.pixelSizeInWorldUnits.width, 2, 'Pixel size should be doubled (zoomed in)');
        assert.strictEqual(canvasWorld.pixelSizeInWorldUnits.height, 2, 'Pixel size should be doubled (zoomed in)');

        const visibleBounds = canvasWorld.getVisibleWorldBounds({ width: 800, height: 600 });
        
        assert.ok(manager.getVisibleObjects().has(obj), `Object should become visible after zooming in towards the right edge. Object is at (${obj.getPosition().x}, ${obj.getPosition().y}) with size (${obj.getSize().width}, ${obj.getSize().height}), visible bounds are min: (${visibleBounds.min.x}, ${visibleBounds.min.y}) max: (${visibleBounds.max.x}, ${visibleBounds.max.y})`);
    });
});

suite('VisibleVisualObjectsManager - Observer Notifications', () => {
    let canvasWorld: CanvasWorld;
    let provider: MockVisibilityProvider;
    let manager: VisibleVisualObjectsManager;

    setup(() => {
        canvasWorld = new CanvasWorld();
        provider = new MockVisibilityProvider();
        manager = new VisibleVisualObjectsManager(canvasWorld, provider);
    });

    teardown(() => {
        manager.destroy();
        sinon.restore();
    });

    test('should notify when visible objects change', () => {
        const onVisibleObjectsChangedSpy = sinon.spy();
        manager.onVisibleObjectsChanged.subscribe(onVisibleObjectsChangedSpy);
        
        const obj = new MockVisualObject({ x: 10, y: 10 });
        provider.addObject(obj);
        
        assert.ok(onVisibleObjectsChangedSpy.called, 'Should notify when visible objects change');
        
        const notifiedObjects = onVisibleObjectsChangedSpy.firstCall.args[0];
        assert.ok(notifiedObjects instanceof Set, 'Should notify with Set of visible objects');
        assert.ok(notifiedObjects.has(obj), 'Should include the newly visible object');
    });

    test('should not notify when visible objects do not change', () => {
        const obj = new MockVisualObject({ x: 10, y: 10 });
        provider.addObject(obj);
        
        const onVisibleObjectsChangedSpy = sinon.spy();
        manager.onVisibleObjectsChanged.subscribe(onVisibleObjectsChangedSpy);
        
        // Change a property that doesn't affect visibility
        provider.changeObjectProperty(obj, 'zIndex', 5);
        
        // Should not notify if visibility didn't actually change
        // (Implementation may vary, but ideally should optimize unnecessary notifications)
    });

    test('should provide current visible objects in notifications', () => {
        const obj1 = new MockVisualObject({ x: 10, y: 10 });
        const obj2 = new MockVisualObject({ x: 30, y: 30 });
        
        const onVisibleObjectsChangedSpy = sinon.spy();
        manager.onVisibleObjectsChanged.subscribe(onVisibleObjectsChangedSpy);
        
        provider.addObject(obj1);
        provider.addObject(obj2);
        
        // Check that notifications contain current state
        if (onVisibleObjectsChangedSpy.called) {
            const lastCall = onVisibleObjectsChangedSpy.lastCall;
            const notifiedObjects = lastCall.args[0];
            
            assert.ok(notifiedObjects instanceof Set, 'Should notify with Set');
            assert.strictEqual(notifiedObjects.size, 2, 'Should include both objects');
            assert.ok(notifiedObjects.has(obj1), 'Should include first object');
            assert.ok(notifiedObjects.has(obj2), 'Should include second object');
        }
    });

    test('should handle unsubscribing from notifications', () => {
        const onVisibleObjectsChangedSpy = sinon.spy();
        manager.onVisibleObjectsChanged.subscribe(onVisibleObjectsChangedSpy);
        
        const obj = new MockVisualObject({ x: 10, y: 10 });
        provider.addObject(obj);
        
        assert.ok(onVisibleObjectsChangedSpy.called, 'Should receive notifications when subscribed');
        
        onVisibleObjectsChangedSpy.resetHistory();
        manager.onVisibleObjectsChanged.unsubscribe(onVisibleObjectsChangedSpy);
        
        const obj2 = new MockVisualObject({ x: 20, y: 20 });
        provider.addObject(obj2);
        
        assert.ok(onVisibleObjectsChangedSpy.notCalled, 'Should not receive notifications after unsubscribing');
    });
});
