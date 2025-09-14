import * as assert from 'assert';
import * as sinon from 'sinon';
import { createMemento } from '../../../../../../src/code/Visualizer/GUIComponents/MementoSystem/Memento/memento';
import { InMemoryMementoRegistry } from '../../../../../../src/code/Visualizer/GUIComponents/MementoSystem/Memento/InMemoryMementoRegistry';
import { MockMementoObject, MockMementoObjectWithReferences, MockMementoParent, MockMementoChild } from './MementoTestHelpers';

suite('createMemento', () => {
    suite('createMemento - WithMemento References', () => {
        let registry: InMemoryMementoRegistry;

        setup(() => {
            registry = new InMemoryMementoRegistry();
        });

        teardown(() => {
            sinon.restore();
        });

        test('should create references to registered WithMemento objects', () => {
            const relatedObj = new MockMementoObject('related-123');
            const mainObj = new MockMementoObjectWithReferences('main-456', 'main', relatedObj);

            registry.register(relatedObj);

            const result = createMemento(mainObj, registry);

            assert.strictEqual(result.success, true, 'Should succeed');
            assert.ok(result.memento, 'Should have memento');

            const references = result.memento!.references;
            assert.strictEqual(references.relatedObject, 'related-123', 'Should store reference ID');
            assert.strictEqual(result.memento!.primitives.name, 'main', 'Should still store primitive properties');
            assert.deepStrictEqual(result.autoRegisteredIds, [], 'Should not auto-register when disabled');
        });

        test('should skip unregistered WithMemento objects when auto-register disabled', () => {
            const unregisteredObj = new MockMementoObject('unregistered-789');
            const mainObj = new MockMementoObjectWithReferences('main-101', 'main', unregisteredObj);

            const result = createMemento(mainObj, registry);

            assert.strictEqual(result.success, true, 'Should succeed');
            assert.ok(result.skippedProperties.includes('relatedObject'), 'Should skip unregistered object property');
            assert.strictEqual(Object.keys(result.memento!.references).length, 0, 'Should have no references');
            assert.deepStrictEqual(result.autoRegisteredIds, [], 'Should not auto-register');
        });

        test('should auto-register unregistered WithMemento objects when enabled', () => {
            const unregisteredObj = new MockMementoObject('auto-reg-456');
            const mainObj = new MockMementoObjectWithReferences('main-789', 'main', unregisteredObj);

            const result = createMemento(mainObj, registry, { autoRegister: true });

            assert.strictEqual(result.success, true, 'Should succeed');
            assert.strictEqual(result.memento!.references.relatedObject, 'auto-reg-456', 'Should store auto-registered reference');
            assert.deepStrictEqual(result.autoRegisteredIds, ['auto-reg-456'], 'Should track auto-registered object');
            assert.strictEqual(registry.isRegistered('auto-reg-456'), true, 'Object should be registered');
        });

        test('should handle multiple WithMemento references', () => {
            const obj1 = new MockMementoObject('ref1');
            const obj2 = new MockMementoObject('ref2');
            const obj3 = new MockMementoObject('ref3');

            registry.register(obj1);
            registry.register(obj2);

            const mainObj = new MockMementoObjectWithReferences('main', 'test');
            (mainObj as any).firstRef = obj1;
            (mainObj as any).secondRef = obj2;
            (mainObj as any).thirdRef = obj3; // Unregistered

            const result = createMemento(mainObj, registry, { autoRegister: true });

            assert.strictEqual(result.success, true, 'Should succeed');
            assert.strictEqual(result.memento!.references.firstRef, 'ref1', 'Should reference first object');
            assert.strictEqual(result.memento!.references.secondRef, 'ref2', 'Should reference second object');
            assert.strictEqual(result.memento!.references.thirdRef, 'ref3', 'Should auto-register and reference third object');
            assert.deepStrictEqual(result.autoRegisteredIds, ['ref3'], 'Should track auto-registered object');
        });
    });

    suite('createMemento - Object Relationships with WithMemento', () => {
        let registry: InMemoryMementoRegistry;

        setup(() => {
            registry = new InMemoryMementoRegistry();
        });

        teardown(() => {
            sinon.restore();
        });

        test('should handle circular object relationships without recursion', () => {
            const parent = new MockMementoParent('parent-1');
            const child = new MockMementoChild('child-1');

            parent.addChild(child); // Creates circular reference: parent -> child -> parent

            registry.register(parent);
            registry.register(child);

            const result = createMemento(parent, registry);

            assert.strictEqual(result.success, true, 'Should succeed - no recursive memento creation');
            assert.ok(result.memento, 'Should have memento');

            // Should store references to child objects, not create their mementos recursively
            const collections = result.memento!.collections;
            assert.ok(collections.children, 'Should have children collection');
            assert.ok(collections.children.references.includes('child-1'), 'Should reference child object');
        });

        test('should store object references without recursive depth issues', () => {
            const obj1 = new MockMementoObjectWithReferences('level1');
            const obj2 = new MockMementoObjectWithReferences('level2');
            const obj3 = new MockMementoObjectWithReferences('level3');

            obj1.relatedObject = obj2;
            obj2.relatedObject = obj3;

            registry.register(obj1);
            registry.register(obj2);
            registry.register(obj3);

            const result = createMemento(obj1, registry, { maxDepth: 1 });

            assert.strictEqual(result.success, true, 'Should succeed - only processing current object');
            assert.ok(result.memento, 'Should have memento');
            assert.strictEqual(result.memento!.references.relatedObject, 'level2', 'Should reference level2 object');
            // No recursive processing means depth limit doesn't affect reference storage
        });
    });
});