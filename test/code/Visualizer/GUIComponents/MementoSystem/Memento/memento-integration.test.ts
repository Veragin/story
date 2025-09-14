import * as assert from 'assert';
import * as sinon from 'sinon';
import { createMemento } from '../../../../../../src/code/Visualizer/GUIComponents/MementoSystem/Memento/memento';
import { InMemoryMementoRegistry } from '../../../../../../src/code/Visualizer/GUIComponents/MementoSystem/Memento/InMemoryMementoRegistry';
import { MockMementoObject, MockMementoObjectWithReferences } from './MementoTestHelpers';

suite('createMemento - Integration Tests', () => {
    let registry: InMemoryMementoRegistry;

    setup(() => {
        registry = new InMemoryMementoRegistry();
    });

    teardown(() => {
        sinon.restore();
    });

    test('should handle complex object with primitives, references, and arrays', () => {
        const relatedObj = new MockMementoObject('complex-related');
        const arrayObj = new MockMementoObject('array-obj');
        registry.register(relatedObj);
        registry.register(arrayObj);
        
        const complexObj = new MockMementoObjectWithReferences(
            'complex-main',
            'Complex Object',
            relatedObj,
            [arrayObj],
            ['primitive', 42, arrayObj]
        );

        const result = createMemento(complexObj, registry);

        assert.strictEqual(result.success, true, 'Should succeed');
        assert.ok(result.memento, 'Should have memento');
        
        // Check primitives
        assert.strictEqual(result.memento!.primitives.name, 'Complex Object', 'Should store primitive');
        
        // Check references
        assert.strictEqual(result.memento!.references.relatedObject, 'complex-related', 'Should store object reference');
        
        // Check collections
        assert.ok(result.memento!.collections.relatedObjects, 'Should have relatedObjects collection');
        assert.ok(result.memento!.collections.mixedArray, 'Should have mixedArray collection');
        
        const relatedCollection = result.memento!.collections.relatedObjects;
        assert.ok(relatedCollection.references.includes('array-obj'), 'Should reference array object');
        
        const mixedCollection = result.memento!.collections.mixedArray;
        assert.strictEqual(mixedCollection.primitives.length, 2, 'Should have 2 primitives in mixed array');
        assert.strictEqual(mixedCollection.references.length, 1, 'Should have 1 reference in mixed array');
    });

    test('should respect skipProperties with different property types', () => {
        const relatedObj = new MockMementoObject('skip-related');
        registry.register(relatedObj);
        
        const obj = new MockMementoObjectWithReferences(
            'skip-test',
            'Skip Test',
            relatedObj,
            [relatedObj],
            ['skip', 'me']
        );

        const result = createMemento(obj, registry, {
            skipProperties: ['name', 'relatedObject', 'mixedArray']
        });

        assert.strictEqual(result.success, true, 'Should succeed');
        assert.ok(result.skippedProperties.includes('name'), 'Should skip name property');
        assert.ok(result.skippedProperties.includes('relatedObject'), 'Should skip relatedObject property');
        assert.ok(result.skippedProperties.includes('mixedArray'), 'Should skip mixedArray property');
        
        assert.strictEqual(Object.keys(result.memento!.primitives).length, 1, 'Should have only id primitive'); // Only 'id' should remain
        assert.strictEqual(Object.keys(result.memento!.references).length, 0, 'Should have no references');
        assert.ok(result.memento!.collections.relatedObjects, 'Should still have non-skipped collection');
    });

    test('should provide comprehensive result information', () => {
        const registeredObj = new MockMementoObject('already-registered');
        const unregisteredObj = new MockMementoObject('to-be-registered');
        registry.register(registeredObj);
        
        const obj = new MockMementoObjectWithReferences(
            'comprehensive-test',
            'Test',
            registeredObj
        );
        (obj as any).unregisteredRef = unregisteredObj;
        (obj as any).plainObject = { nested: 'skip me' };

        const result = createMemento(obj, registry, { autoRegister: true });

        assert.strictEqual(result.success, true, 'Should succeed');
        assert.ok(result.memento, 'Should have memento');
        assert.ok(result.skippedProperties.includes('plainObject'), 'Should skip plain objects');
        assert.deepStrictEqual(result.autoRegisteredIds, ['to-be-registered'], 'Should track auto-registered objects');
        
        // Verify complete memento structure
        assert.strictEqual(result.memento!.id, 'comprehensive-test', 'Should have correct ID');
        assert.strictEqual(result.memento!.type, 'MockMementoObjectWithReferences', 'Should have correct type');
        assert.ok(result.memento!.timestamp > 0, 'Should have timestamp');
        assert.ok(typeof result.memento!.primitives === 'object', 'Should have primitives object');
        assert.ok(typeof result.memento!.references === 'object', 'Should have references object');
        assert.ok(typeof result.memento!.collections === 'object', 'Should have collections object');
    });
});