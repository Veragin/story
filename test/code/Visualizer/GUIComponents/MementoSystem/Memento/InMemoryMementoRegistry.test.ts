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
}

import * as assert from 'assert';
import * as sinon from 'sinon';
import { InMemoryMementoRegistry } from '../../../../../../src/code/Visualizer/GUIComponents/MementoSystem/Memento/InMemoryMementoRegistry';
import { MockMementoObject, EmptyMementoObject } from './MementoTestHelpers';

suite('InMemoryMementoRegistry - Basic Operations', () => {
    let registry: InMemoryMementoRegistry;

    setup(() => {
        registry = new InMemoryMementoRegistry();
    });

    teardown(() => {
        sinon.restore();
    });

    test('should initialize empty', () => {
        assert.strictEqual(registry.getRegisteredIds().length, 0, 'Registry should start empty');
        assert.strictEqual(registry.isRegistered('any-id'), false, 'Should not find any objects initially');
    });

    test('should register new object successfully', () => {
        const obj = new MockMementoObject('test-id-1');
        
        const result = registry.register(obj);
        
        assert.strictEqual(result, true, 'Should return true when registering new object');
        assert.strictEqual(registry.isRegistered('test-id-1'), true, 'Should find registered object');
        assert.deepStrictEqual(registry.getRegisteredIds(), ['test-id-1'], 'Should list registered ID');
    });

    test('should not register duplicate objects', () => {
        const obj1 = new MockMementoObject('duplicate-id');
        const obj2 = new MockMementoObject('duplicate-id');
        
        const result1 = registry.register(obj1);
        const result2 = registry.register(obj2);
        
        assert.strictEqual(result1, true, 'First registration should succeed');
        assert.strictEqual(result2, false, 'Second registration should fail');
        assert.strictEqual(registry.getRegisteredIds().length, 1, 'Should only have one object registered');
    });

    test('should retrieve registered object by ID', () => {
        const obj = new MockMementoObject('retrieve-test');
        registry.register(obj);
        
        const retrieved = registry.get('retrieve-test');
        
        assert.strictEqual(retrieved, obj, 'Should return the exact same object instance');
    });

    test('should return undefined for non-existent ID', () => {
        const retrieved = registry.get('non-existent');
        
        assert.strictEqual(retrieved, undefined, 'Should return undefined for non-existent ID');
    });

    test('should clear all registered objects', () => {
        const obj1 = new MockMementoObject('obj1');
        const obj2 = new MockMementoObject('obj2');
        registry.register(obj1);
        registry.register(obj2);
        
        registry.clear();
        
        assert.strictEqual(registry.getRegisteredIds().length, 0, 'Should have no registered objects after clear');
        assert.strictEqual(registry.isRegistered('obj1'), false, 'Should not find obj1 after clear');
        assert.strictEqual(registry.isRegistered('obj2'), false, 'Should not find obj2 after clear');
    });

    test('should handle multiple objects with different IDs', () => {
        const objects = [
            new MockMementoObject('id1'),
            new MockMementoObject('id2'),
            new MockMementoObject('id3')
        ];
        
        objects.forEach(obj => registry.register(obj));
        
        const registeredIds = registry.getRegisteredIds();
        assert.strictEqual(registeredIds.length, 3, 'Should have three registered objects');
        assert.ok(registeredIds.includes('id1'), 'Should include id1');
        assert.ok(registeredIds.includes('id2'), 'Should include id2');
        assert.ok(registeredIds.includes('id3'), 'Should include id3');
    });
});