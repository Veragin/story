import * as assert from 'assert';
import * as sinon from 'sinon';
import { createMemento } from '../../../../../../src/code/Visualizer/GUIComponents/MementoSystem/Memento/memento';
import { InMemoryMementoRegistry } from '../../../../../../src/code/Visualizer/GUIComponents/MementoSystem/Memento/InMemoryMementoRegistry';
import { MockMementoObject, MockMementoObjectWithReferences } from './MementoTestHelpers';

suite('createMemento - Array Properties', () => {
    let registry: InMemoryMementoRegistry;

    setup(() => {
        registry = new InMemoryMementoRegistry();
    });

    teardown(() => {
        sinon.restore();
    });

    test('should handle objects with array properties containing primitives', () => {
        const obj = new MockMementoObjectWithReferences(
            'array-test',
            'test',
            undefined,
            undefined,
            ['string', 42, true, null]
        );

        const result = createMemento(obj, registry);

        assert.strictEqual(result.success, true, 'Should succeed');
        assert.ok(result.memento, 'Should have memento');
        
        const collections = result.memento!.collections;
        assert.ok(collections.mixedArray, 'Should have mixedArray collection');
        assert.strictEqual(collections.mixedArray.type, 'array', 'Should be array type');
        assert.strictEqual(collections.mixedArray.primitives.length, 4, 'Should have 4 primitives');
        assert.strictEqual(collections.mixedArray.references.length, 0, 'Should have no references');
    });

    test('should handle arrays with WithMemento objects', () => {
        const relatedObj1 = new MockMementoObject('related1');
        const relatedObj2 = new MockMementoObject('related2');
        registry.register(relatedObj1);
        registry.register(relatedObj2);
        
        const obj = new MockMementoObjectWithReferences(
            'array-refs-test',
            'test',
            undefined,
            [relatedObj1, relatedObj2]
        );

        const result = createMemento(obj, registry);

        assert.strictEqual(result.success, true, 'Should succeed');
        
        const collections = result.memento!.collections;
        assert.ok(collections.relatedObjects, 'Should have relatedObjects collection');
        assert.strictEqual(collections.relatedObjects.references.length, 2, 'Should have 2 references');
        assert.ok(collections.relatedObjects.references.includes('related1'), 'Should include related1');
        assert.ok(collections.relatedObjects.references.includes('related2'), 'Should include related2');
    });

    test('should handle mixed arrays with primitives and WithMemento objects', () => {
        const relatedObj = new MockMementoObject('mixed-related');
        registry.register(relatedObj);
        
        const obj = new MockMementoObjectWithReferences(
            'mixed-array-test',
            'test',
            undefined,
            undefined,
            ['text', 123, relatedObj, false]
        );

        const result = createMemento(obj, registry);

        assert.strictEqual(result.success, true, 'Should succeed');
        
        const collection = result.memento!.collections.mixedArray;
        assert.strictEqual(collection.primitives.length, 3, 'Should have 3 primitives');
        assert.strictEqual(collection.references.length, 1, 'Should have 1 reference');
        assert.ok(collection.references.includes('mixed-related'), 'Should include object reference');
    });

    test('should auto-register objects in arrays when enabled', () => {
        const unregisteredObj = new MockMementoObject('array-auto-reg');
        const obj = new MockMementoObjectWithReferences(
            'auto-reg-array-test',
            'test',
            undefined,
            [unregisteredObj]
        );

        const result = createMemento(obj, registry, { autoRegister: true });

        assert.strictEqual(result.success, true, 'Should succeed');
        assert.deepStrictEqual(result.autoRegisteredIds, ['array-auto-reg'], 'Should auto-register array object');
        assert.strictEqual(registry.isRegistered('array-auto-reg'), true, 'Object should be registered');
        
        const collection = result.memento!.collections.relatedObjects;
        assert.ok(collection.references.includes('array-auto-reg'), 'Should include auto-registered reference');
    });
});