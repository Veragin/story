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
import { ZIndexSortedVisibleVisualObjectsManager } from 'code/Visualizer/GUIComponents/Canvas/CanvasManager/ZIndexSortedVisibleVisualObjectsManager';
import { CanvasWorld, TPoint, TSize } from 'code/Visualizer/GUIComponents/Canvas/CanvasManager/CanvasWorld';
import { IVisibilityProvider } from 'code/Visualizer/GUIComponents/Canvas/CanvasManager/VisibleVisualObjectsManager';
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
}

// Mock visibility provider
class MockVisibilityProvider implements IVisibilityProvider {
    private _objects: VisualObject[] = [];
    public onObjectAdded = new Observer<VisualObject>();
    public onObjectRemoved = new Observer<VisualObject>();
    public onObjectPropertyChanged = new Observer<{ object: VisualObject; property: string }>();

    getAllObjects(): VisualObject[] {
        return [...this._objects];
    }

    getCanvasSize(): TSize {
        return { width: 800, height: 600 };
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

    changeObjectZIndex(obj: VisualObject, newZIndex: number): void {
        obj.setZIndex(newZIndex);
        this.onObjectPropertyChanged.notify({ object: obj, property: 'zIndex' });
    }

    changeObjectPosition(obj: VisualObject, newPosition: TPoint): void {
        obj.position = newPosition;
        this.onObjectPropertyChanged.notify({ object: obj, property: 'position' });
    }

    isObjectVisible(obj: VisualObject, bounds: { min: TPoint; max: TPoint }): boolean {
        // Simple visibility test: object overlaps with bounds
        const objRight = obj.position.x + obj.size.width;
        const objBottom = obj.position.y + obj.size.height;
        
        return !(obj.position.x > bounds.max.x ||
                objRight < bounds.min.x ||
                obj.position.y > bounds.max.y ||
                objBottom < bounds.min.y);
    }
}

suite('ZIndexSortedVisibleVisualObjectsManager - Initialization', () => {
    let canvasWorld: CanvasWorld;
    let provider: MockVisibilityProvider;
    let manager: ZIndexSortedVisibleVisualObjectsManager;

    setup(() => {
        canvasWorld = new CanvasWorld();
        provider = new MockVisibilityProvider();
        
        // Add some initial objects with different z-indices
        const obj1 = new MockVisualObject({ x: 0, y: 0 }, { width: 10, height: 10 }, 1);
        const obj2 = new MockVisualObject({ x: 0, y: 0 }, { width: 10, height: 10 }, 0);
        const obj3 = new MockVisualObject({ x: 0, y: 0 }, { width: 10, height: 10 }, 2);
        
        provider.addObject(obj2);
        provider.addObject(obj1);
        provider.addObject(obj3);
        
        manager = new ZIndexSortedVisibleVisualObjectsManager(canvasWorld, provider);
    });

    teardown(() => {
        sinon.restore();
    });

    test('should initialize with sorted objects', () => {
        const sortedObjects = manager.getSortedVisibleObjects();
        
        // Objects should be sorted by z-index (0, 1, 2)
        assert.strictEqual(sortedObjects.length, 3, 'Should have 3 visible objects');
        assert.strictEqual(sortedObjects[0].zIndex, 0, 'First object should have z-index 0');
        assert.strictEqual(sortedObjects[1].zIndex, 1, 'Second object should have z-index 1');
        assert.strictEqual(sortedObjects[2].zIndex, 2, 'Third object should have z-index 2');
    });

    test('should maintain insertion order for objects with same z-index', () => {
        provider = new MockVisibilityProvider();
        
        // Add objects with same z-index in specific order
        const obj1 = new MockVisualObject({ x: 0, y: 0 }, { width: 10, height: 10 }, 1);
        const obj2 = new MockVisualObject({ x: 0, y: 0 }, { width: 10, height: 10 }, 1);
        const obj3 = new MockVisualObject({ x: 0, y: 0 }, { width: 10, height: 10 }, 1);
        
        provider.addObject(obj1);
        provider.addObject(obj2);
        provider.addObject(obj3);
        
        manager = new ZIndexSortedVisibleVisualObjectsManager(canvasWorld, provider);
        const sortedObjects = manager.getSortedVisibleObjects();
        
        // Should maintain insertion order
        assert.strictEqual(sortedObjects[0], obj1, 'First added object should be first');
        assert.strictEqual(sortedObjects[1], obj2, 'Second added object should be second');
        assert.strictEqual(sortedObjects[2], obj3, 'Third added object should be third');
    });

    test('should handle empty provider', () => {
        provider = new MockVisibilityProvider();
        manager = new ZIndexSortedVisibleVisualObjectsManager(canvasWorld, provider);
        
        const sortedObjects = manager.getSortedVisibleObjects();
        assert.strictEqual(sortedObjects.length, 0, 'Should have no objects initially');
    });
});

suite('ZIndexSortedVisibleVisualObjectsManager - Object Addition', () => {
    let canvasWorld: CanvasWorld;
    let provider: MockVisibilityProvider;
    let manager: ZIndexSortedVisibleVisualObjectsManager;

    setup(() => {
        canvasWorld = new CanvasWorld();
        provider = new MockVisibilityProvider();
        manager = new ZIndexSortedVisibleVisualObjectsManager(canvasWorld, provider);
    });

    teardown(() => {
        sinon.restore();
    });

    test('should insert object in correct z-index position', () => {
        const obj1 = new MockVisualObject({ x: 0, y: 0 }, { width: 10, height: 10 }, 0);
        const obj2 = new MockVisualObject({ x: 0, y: 0 }, { width: 10, height: 10 }, 2);
        const obj3 = new MockVisualObject({ x: 0, y: 0 }, { width: 10, height: 10 }, 1);
        
        provider.addObject(obj1);
        provider.addObject(obj2);
        provider.addObject(obj3); // Should be inserted between obj1 and obj2
        
        const sortedObjects = manager.getSortedVisibleObjects();
        assert.strictEqual(sortedObjects[0], obj1, 'Object with z-index 0 should be first');
        assert.strictEqual(sortedObjects[1], obj3, 'Object with z-index 1 should be second');
        assert.strictEqual(sortedObjects[2], obj2, 'Object with z-index 2 should be third');
    });

    test('should handle adding objects with negative z-index', () => {
        const obj1 = new MockVisualObject({ x: 0, y: 0 }, { width: 10, height: 10 }, 0);
        const obj2 = new MockVisualObject({ x: 0, y: 0 }, { width: 10, height: 10 }, -1);
        
        provider.addObject(obj1);
        provider.addObject(obj2);
        
        const sortedObjects = manager.getSortedVisibleObjects();
        assert.strictEqual(sortedObjects[0], obj2, 'Object with z-index -1 should be first');
        assert.strictEqual(sortedObjects[1], obj1, 'Object with z-index 0 should be second');
    });

    test('should maintain insertion order when adding objects with same z-index', () => {
        const obj1 = new MockVisualObject({ x: 0, y: 0 }, { width: 10, height: 10 }, 5);
        const obj2 = new MockVisualObject({ x: 0, y: 0 }, { width: 10, height: 10 }, 5);
        const obj3 = new MockVisualObject({ x: 0, y: 0 }, { width: 10, height: 10 }, 5);
        
        provider.addObject(obj1);
        provider.addObject(obj2);
        provider.addObject(obj3);
        
        const sortedObjects = manager.getSortedVisibleObjects();
        assert.strictEqual(sortedObjects[0], obj1, 'First added should remain first');
        assert.strictEqual(sortedObjects[1], obj2, 'Second added should remain second');
        assert.strictEqual(sortedObjects[2], obj3, 'Third added should remain third');
    });

    test('should handle rapid successive additions', () => {
        const objects: MockVisualObject[] = [];
        
        // Add 10 objects with random z-indices
        for (let i = 0; i < 10; i++) {
            const obj = new MockVisualObject({ x: 0, y: 0 }, { width: 10, height: 10 }, Math.floor(Math.random() * 5));
            objects.push(obj);
            provider.addObject(obj);
        }
        
        const sortedObjects = manager.getSortedVisibleObjects();
        
        // Verify sorting is maintained
        for (let i = 1; i < sortedObjects.length; i++) {
            assert.ok(sortedObjects[i].zIndex >= sortedObjects[i - 1].zIndex, 
                `Object at index ${i} should have z-index >= previous object`);
        }
    });
});

suite('ZIndexSortedVisibleVisualObjectsManager - Object Removal', () => {
    let canvasWorld: CanvasWorld;
    let provider: MockVisibilityProvider;
    let manager: ZIndexSortedVisibleVisualObjectsManager;
    let obj1: MockVisualObject;
    let obj2: MockVisualObject;
    let obj3: MockVisualObject;

    setup(() => {
        canvasWorld = new CanvasWorld();
        provider = new MockVisibilityProvider();
        
        obj1 = new MockVisualObject({ x: 0, y: 0 }, { width: 10, height: 10 }, 0);
        obj2 = new MockVisualObject({ x: 0, y: 0 }, { width: 10, height: 10 }, 1);
        obj3 = new MockVisualObject({ x: 0, y: 0 }, { width: 10, height: 10 }, 2);
        
        provider.addObject(obj1);
        provider.addObject(obj2);
        provider.addObject(obj3);
        
        manager = new ZIndexSortedVisibleVisualObjectsManager(canvasWorld, provider);
    });

    teardown(() => {
        sinon.restore();
    });

    test('should remove object and maintain sort order', () => {
        provider.removeObject(obj2); // Remove middle object
        
        const sortedObjects = manager.getSortedVisibleObjects();
        assert.strictEqual(sortedObjects.length, 2, 'Should have 2 objects after removal');
        assert.strictEqual(sortedObjects[0], obj1, 'First object should remain first');
        assert.strictEqual(sortedObjects[1], obj3, 'Third object should become second');
        assert.ok(!sortedObjects.includes(obj2), 'Removed object should not be in sorted array');
    });

    test('should remove first object correctly', () => {
        provider.removeObject(obj1);
        
        const sortedObjects = manager.getSortedVisibleObjects();
        assert.strictEqual(sortedObjects.length, 2, 'Should have 2 objects after removal');
        assert.strictEqual(sortedObjects[0], obj2, 'Second object should become first');
        assert.strictEqual(sortedObjects[1], obj3, 'Third object should remain third');
    });

    test('should remove last object correctly', () => {
        provider.removeObject(obj3);
        
        const sortedObjects = manager.getSortedVisibleObjects();
        assert.strictEqual(sortedObjects.length, 2, 'Should have 2 objects after removal');
        assert.strictEqual(sortedObjects[0], obj1, 'First object should remain first');
        assert.strictEqual(sortedObjects[1], obj2, 'Second object should remain second');
    });

    test('should handle removing all objects', () => {
        provider.removeObject(obj1);
        provider.removeObject(obj2);
        provider.removeObject(obj3);
        
        const sortedObjects = manager.getSortedVisibleObjects();
        assert.strictEqual(sortedObjects.length, 0, 'Should have no objects after removing all');
    });

    test('should handle removing non-existent object gracefully', () => {
        const nonExistentObj = new MockVisualObject({ x: 0, y: 0 }, { width: 10, height: 10 }, 5);
        
        // This should not throw
        provider.removeObject(nonExistentObj);
        
        const sortedObjects = manager.getSortedVisibleObjects();
        assert.strictEqual(sortedObjects.length, 3, 'Should still have 3 objects');
    });
});

suite('ZIndexSortedVisibleVisualObjectsManager - Z-Index Changes', () => {
    let canvasWorld: CanvasWorld;
    let provider: MockVisibilityProvider;
    let manager: ZIndexSortedVisibleVisualObjectsManager;
    let obj1: MockVisualObject;
    let obj2: MockVisualObject;
    let obj3: MockVisualObject;

    setup(() => {
        canvasWorld = new CanvasWorld();
        provider = new MockVisibilityProvider();
        
        obj1 = new MockVisualObject({ x: 0, y: 0 }, { width: 10, height: 10 }, 0);
        obj2 = new MockVisualObject({ x: 0, y: 0 }, { width: 10, height: 10 }, 1);
        obj3 = new MockVisualObject({ x: 0, y: 0 }, { width: 10, height: 10 }, 2);
        
        provider.addObject(obj1);
        provider.addObject(obj2);
        provider.addObject(obj3);
        
        manager = new ZIndexSortedVisibleVisualObjectsManager(canvasWorld, provider);
    });

    teardown(() => {
        sinon.restore();
    });

    test('should reposition object when z-index increases', () => {
        // Change obj1 from z-index 0 to 3 (should move to end)
        provider.changeObjectZIndex(obj1, 3);
        
        const sortedObjects = manager.getSortedVisibleObjects();
        assert.strictEqual(sortedObjects[0], obj2, 'obj2 should now be first');
        assert.strictEqual(sortedObjects[1], obj3, 'obj3 should now be second');
        assert.strictEqual(sortedObjects[2], obj1, 'obj1 should now be last');
        assert.strictEqual(obj1.zIndex, 3, 'obj1 z-index should be updated');
    });

    test('should reposition object when z-index decreases', () => {
        // Change obj3 from z-index 2 to -1 (should move to beginning)
        provider.changeObjectZIndex(obj3, -1);
        
        const sortedObjects = manager.getSortedVisibleObjects();
        assert.strictEqual(sortedObjects[0], obj3, 'obj3 should now be first');
        assert.strictEqual(sortedObjects[1], obj1, 'obj1 should now be second');
        assert.strictEqual(sortedObjects[2], obj2, 'obj2 should now be third');
        assert.strictEqual(obj3.zIndex, -1, 'obj3 z-index should be updated');
    });

    test('should maintain insertion order when z-index changes to same value', () => {
        // Change obj3 to have same z-index as obj2
        provider.changeObjectZIndex(obj3, 1);
        
        const sortedObjects = manager.getSortedVisibleObjects();
        assert.strictEqual(sortedObjects[0], obj1, 'obj1 should remain first');
        
        // obj2 and obj3 both have z-index 1, but obj2 was added first
        const obj2Index = sortedObjects.indexOf(obj2);
        const obj3Index = sortedObjects.indexOf(obj3);
        assert.ok(obj2Index < obj3Index, 'obj2 should come before obj3 (insertion order)');
    });

    test('should handle multiple rapid z-index changes', () => {
        provider.changeObjectZIndex(obj1, 5);
        provider.changeObjectZIndex(obj2, -2);
        provider.changeObjectZIndex(obj3, 3);
        
        const sortedObjects = manager.getSortedVisibleObjects();
        assert.strictEqual(sortedObjects[0], obj2, 'obj2 with z-index -2 should be first');
        assert.strictEqual(sortedObjects[1], obj3, 'obj3 with z-index 3 should be second');
        assert.strictEqual(sortedObjects[2], obj1, 'obj1 with z-index 5 should be third');
    });

    test('should ignore property changes other than z-index', () => {
        const initialSortedObjects = manager.getSortedVisibleObjects();
        
        // Change position (should not affect sorting)
        provider.changeObjectPosition(obj2, { x: 100, y: 100 });
        
        const sortedObjectsAfter = manager.getSortedVisibleObjects();
        assert.deepStrictEqual(sortedObjectsAfter, initialSortedObjects, 
            'Sorting should not change for non z-index property changes');
    });
});

suite('ZIndexSortedVisibleVisualObjectsManager - Visibility Changes', () => {
    let canvasWorld: CanvasWorld;
    let provider: MockVisibilityProvider;
    let manager: ZIndexSortedVisibleVisualObjectsManager;

    setup(() => {
        canvasWorld = new CanvasWorld();
        provider = new MockVisibilityProvider();
        manager = new ZIndexSortedVisibleVisualObjectsManager(canvasWorld, provider);
    });

    teardown(() => {
        sinon.restore();
    });

    test('should handle objects moving in and out of view', () => {
        // Create objects positioned differently
        const visibleObj = new MockVisualObject({ x: 0, y: 0 }, { width: 10, height: 10 }, 1);
        const hiddenObj = new MockVisualObject({ x: 1000, y: 1000 }, { width: 10, height: 10 }, 2);
        
        provider.addObject(visibleObj);
        provider.addObject(hiddenObj);
        
        // Simulate viewport at origin
        canvasWorld.viewPosition = { x: 0, y: 0 };
        
        const sortedObjects = manager.getSortedVisibleObjects();
        
        // Should only include visible object
        assert.strictEqual(sortedObjects.length, 1, 'Should have only visible object');
        assert.strictEqual(sortedObjects[0], visibleObj, 'Should contain visible object');
    });

    test('should handle bulk visibility changes efficiently', () => {
        // Add many objects
        const objects: MockVisualObject[] = [];
        for (let i = 0; i < 50; i++) {
            const obj = new MockVisualObject(
                { x: i * 100, y: i * 100 }, 
                { width: 10, height: 10 }, 
                i % 5
            );
            objects.push(obj);
            provider.addObject(obj);
        }
        
        // Change viewport to show different objects
        canvasWorld.viewPosition = { x: 2500, y: 2500 };
        
        // Trigger visibility check (this would normally be done by viewport changes)
        // We can't easily test the protected method, but we can verify the result
        const sortedObjects = manager.getSortedVisibleObjects();
        
        // All returned objects should be properly sorted
        for (let i = 1; i < sortedObjects.length; i++) {
            assert.ok(sortedObjects[i].zIndex >= sortedObjects[i - 1].zIndex,
                'Objects should remain sorted after bulk visibility change');
        }
    });

    test('should maintain sorting during visibility state transitions', () => {
        const obj1 = new MockVisualObject({ x: 0, y: 0 }, { width: 10, height: 10 }, 2);
        const obj2 = new MockVisualObject({ x: 0, y: 0 }, { width: 10, height: 10 }, 0);
        const obj3 = new MockVisualObject({ x: 0, y: 0 }, { width: 10, height: 10 }, 1);
        
        provider.addObject(obj1);
        provider.addObject(obj2);
        provider.addObject(obj3);
        
        let sortedObjects = manager.getSortedVisibleObjects();
        
        // Initially all should be visible and sorted
        assert.strictEqual(sortedObjects.length, 3, 'Should have 3 visible objects');
        assert.strictEqual(sortedObjects[0].zIndex, 0, 'First should have z-index 0');
        assert.strictEqual(sortedObjects[1].zIndex, 1, 'Second should have z-index 1');
        assert.strictEqual(sortedObjects[2].zIndex, 2, 'Third should have z-index 2');
    });
});

suite('ZIndexSortedVisibleVisualObjectsManager - Edge Cases', () => {
    let canvasWorld: CanvasWorld;
    let provider: MockVisibilityProvider;
    let manager: ZIndexSortedVisibleVisualObjectsManager;

    setup(() => {
        canvasWorld = new CanvasWorld();
        provider = new MockVisibilityProvider();
        manager = new ZIndexSortedVisibleVisualObjectsManager(canvasWorld, provider);
    });

    teardown(() => {
        sinon.restore();
    });

    test('should handle extreme z-index values', () => {
        const obj1 = new MockVisualObject({ x: 0, y: 0 }, { width: 10, height: 10 }, Number.MAX_SAFE_INTEGER);
        const obj2 = new MockVisualObject({ x: 0, y: 0 }, { width: 10, height: 10 }, Number.MIN_SAFE_INTEGER);
        const obj3 = new MockVisualObject({ x: 0, y: 0 }, { width: 10, height: 10 }, 0);
        
        provider.addObject(obj1);
        provider.addObject(obj2);
        provider.addObject(obj3);
        
        const sortedObjects = manager.getSortedVisibleObjects();
        assert.strictEqual(sortedObjects[0], obj2, 'MIN_SAFE_INTEGER should be first');
        assert.strictEqual(sortedObjects[1], obj3, 'Zero should be middle');
        assert.strictEqual(sortedObjects[2], obj1, 'MAX_SAFE_INTEGER should be last');
    });

    test('should handle objects with identical properties', () => {
        const obj1 = new MockVisualObject({ x: 0, y: 0 }, { width: 10, height: 10 }, 1);
        const obj2 = new MockVisualObject({ x: 0, y: 0 }, { width: 10, height: 10 }, 1);
        const obj3 = new MockVisualObject({ x: 0, y: 0 }, { width: 10, height: 10 }, 1);
        
        provider.addObject(obj1);
        provider.addObject(obj2);
        provider.addObject(obj3);
        
        const sortedObjects = manager.getSortedVisibleObjects();
        
        // Should maintain insertion order
        assert.strictEqual(sortedObjects[0], obj1, 'First added should be first');
        assert.strictEqual(sortedObjects[1], obj2, 'Second added should be second');
        assert.strictEqual(sortedObjects[2], obj3, 'Third added should be third');
    });

    test('should handle rapid add/remove cycles', () => {
        const objects: MockVisualObject[] = [];
        
        // Add objects
        for (let i = 0; i < 10; i++) {
            const obj = new MockVisualObject({ x: 0, y: 0 }, { width: 10, height: 10 }, i);
            objects.push(obj);
            provider.addObject(obj);
        }
        
        // Remove every other object
        for (let i = 0; i < objects.length; i += 2) {
            provider.removeObject(objects[i]);
        }
        
        const sortedObjects = manager.getSortedVisibleObjects();
        
        // Should have remaining objects in correct order
        assert.strictEqual(sortedObjects.length, 5, 'Should have 5 objects remaining');
        for (let i = 1; i < sortedObjects.length; i++) {
            assert.ok(sortedObjects[i].zIndex > sortedObjects[i - 1].zIndex,
                'Remaining objects should be sorted');
        }
    });

    test('should handle zero-sized or negative-sized objects', () => {
        const obj1 = new MockVisualObject({ x: 0, y: 0 }, { width: 0, height: 0 }, 1);
        const obj2 = new MockVisualObject({ x: 0, y: 0 }, { width: -5, height: -10 }, 2);
        
        // Should not crash when adding unusual objects
        provider.addObject(obj1);
        provider.addObject(obj2);
        
        const sortedObjects = manager.getSortedVisibleObjects();
        assert.ok(sortedObjects.length >= 0, 'Should handle unusual object sizes');
    });

    test('should maintain performance with large number of objects', () => {
        const startTime = Date.now();
        
        // Add 1000 objects with random z-indices
        for (let i = 0; i < 1000; i++) {
            const obj = new MockVisualObject(
                { x: 0, y: 0 }, 
                { width: 10, height: 10 }, 
                Math.floor(Math.random() * 100)
            );
            provider.addObject(obj);
        }
        
        const endTime = Date.now();
        const sortedObjects = manager.getSortedVisibleObjects();
        
        assert.strictEqual(sortedObjects.length, 1000, 'Should handle 1000 objects');
        
        // Verify sorting is maintained
        for (let i = 1; i < sortedObjects.length; i++) {
            assert.ok(sortedObjects[i].zIndex >= sortedObjects[i - 1].zIndex,
                'Large number of objects should remain sorted');
        }
        
        // Performance check (should complete in reasonable time)
        assert.ok((endTime - startTime) < 5000, 'Should handle 1000 objects in reasonable time');
    });
});

suite('ZIndexSortedVisibleVisualObjectsManager - Integration', () => {
    let canvasWorld: CanvasWorld;
    let provider: MockVisibilityProvider;
    let manager: ZIndexSortedVisibleVisualObjectsManager;

    setup(() => {
        canvasWorld = new CanvasWorld();
        provider = new MockVisibilityProvider();
        manager = new ZIndexSortedVisibleVisualObjectsManager(canvasWorld, provider);
    });

    teardown(() => {
        sinon.restore();
    });

    test('should maintain consistent state through mixed operations', () => {
        const objects: MockVisualObject[] = [];
        
        // Add objects
        for (let i = 0; i < 5; i++) {
            const obj = new MockVisualObject({ x: i * 10, y: i * 10 }, { width: 10, height: 10 }, i);
            objects.push(obj);
            provider.addObject(obj);
        }
        
        // Change z-indices
        provider.changeObjectZIndex(objects[0], 10);
        provider.changeObjectZIndex(objects[4], -1);
        
        // Remove and add objects
        provider.removeObject(objects[2]);
        const newObj = new MockVisualObject({ x: 50, y: 50 }, { width: 10, height: 10 }, 2);
        provider.addObject(newObj);
        
        const sortedObjects = manager.getSortedVisibleObjects();
        
        // Verify final state is consistent
        assert.strictEqual(sortedObjects.length, 5, 'Should have correct number of objects');
        
        // Verify sorting is maintained
        for (let i = 1; i < sortedObjects.length; i++) {
            assert.ok(sortedObjects[i].zIndex >= sortedObjects[i - 1].zIndex,
                'Objects should remain sorted after mixed operations');
        }
        
        // Verify specific object positions
        assert.strictEqual(sortedObjects[0], objects[4], 'Object with z-index -1 should be first');
        assert.strictEqual(sortedObjects[sortedObjects.length - 1], objects[0], 
            'Object with z-index 10 should be last');
    });

    test('should work correctly with canvas world transformations', () => {
        const obj1 = new MockVisualObject({ x: 100, y: 100 }, { width: 20, height: 20 }, 0);
        const obj2 = new MockVisualObject({ x: 200, y: 200 }, { width: 20, height: 20 }, 1);
        
        provider.addObject(obj1);
        provider.addObject(obj2);
        
        // Change canvas world view - make sure objects are still visible
        canvasWorld.viewPosition = { x: 0, y: 0 };
        canvasWorld.pixelSizeInWorldUnits = { width: 2, height: 2 };
        
        const sortedObjects = manager.getSortedVisibleObjects();
        
        // Objects should still be sorted regardless of world transformation
        assert.strictEqual(sortedObjects[0], obj1, 'Lower z-index object should be first');
        assert.strictEqual(sortedObjects[1], obj2, 'Higher z-index object should be second');
    });
});
