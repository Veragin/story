import * as assert from 'assert';
import * as sinon from 'sinon';
import { MementoSystem } from '../../../../../src/code/Visualizer/GUIComponents/MementoSystem/MementoSystem';
import { InMemoryMementoRegistry } from '../../../../../src/code/Visualizer/GUIComponents/MementoSystem/Memento/InMemoryMementoRegistry';
import { MementoSystemState } from '../../../../../src/code/Visualizer/GUIComponents/MementoSystem/MementoSystemState';
import { MementoSerializer } from '../../../../../src/code/Visualizer/GUIComponents/MementoSystem/MementoSerializer';
import { MockMementoObject, MockMementoObjectWithReferences } from './Memento/MementoTestHelpers';
import { MockMementoStorage } from './MockMementoStorage';

suite('MementoSystem Integration Tests', () => {
    let registry: InMemoryMementoRegistry;
    let storage: MockMementoStorage;
    let system: MementoSystem;
    let serializer: MementoSerializer;

    setup(async () => {
        registry = new InMemoryMementoRegistry();
        storage = new MockMementoStorage();
        serializer = new MementoSerializer();
        system = new MementoSystem('integration-system', 'Integration System', registry, storage, { autoSave: true });
        await system.waitForReady();
    });

    teardown(() => {
        sinon.restore();
    });

    test('should handle complex object graph with auto-save', async () => {
        const child1 = new MockMementoObject('child-1', 'Child One');
        const child2 = new MockMementoObject('child-2', 'Child Two');
        const parent = new MockMementoObjectWithReferences(
            'parent',
            'Parent Object',
            undefined,
            [child1, child2]
        );

        const result = await system.registerObject(parent, { autoRegister: true });

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.autoRegisteredIds.length, 2);
        
        // Should be auto-saved
        assert.strictEqual(system.isMementoSaved('parent'), true);
        assert.strictEqual(system.isMementoSaved('child-1'), true);
        assert.strictEqual(system.isMementoSaved('child-2'), true);

        // Verify in storage
        const parentMemento = await system.loadMemento('parent');
        assert.ok(parentMemento);
        assert.ok(parentMemento.collections.relatedObjects);
        assert.strictEqual(parentMemento.collections.relatedObjects.references.length, 2);
    });

    test('should maintain data consistency across operations', async () => {
        const obj = new MockMementoObject('consistency-test', 'Original', 100);
        
        // Register
        await system.registerObject(obj);
        await system.saveMemento('consistency-test');

        // Verify saved state
        let savedMemento = await system.loadMemento('consistency-test');
        assert.strictEqual(savedMemento?.primitives.name, 'Original');
        assert.strictEqual(savedMemento?.primitives.value, 100);

        // Update object
        obj.name = 'Updated';
        obj.value = 200;
        await system.updateObject(obj);

        // Verify updated state
        savedMemento = await system.loadMemento('consistency-test');
        assert.strictEqual(savedMemento?.primitives.name, 'Updated');
        assert.strictEqual(savedMemento?.primitives.value, 200);
    });

    test('should handle serialization roundtrip correctly', async () => {
        const complexObj = new MockMementoObjectWithReferences(
            'serialization-test',
            'Serialization Test',
            undefined,
            undefined,
            ['text', 42, true, null]
        );

        await system.registerObject(complexObj);
        
        // Get the memento and serialize manually
        const memento = await system.loadMemento('serialization-test');
        assert.ok(memento);
        
        const json = serializer.serialize(memento);
        const deserializedMemento = serializer.deserialize(json);
        
        assert.strictEqual(deserializedMemento.id, memento.id);
        assert.strictEqual(deserializedMemento.type, memento.type);
        assert.deepStrictEqual(deserializedMemento.references, memento.references);
        
        // Check mixed array
        const originalArray = memento.collections.mixedArray;
        const deserializedArray = deserializedMemento.collections.mixedArray;
        assert.strictEqual(deserializedArray.primitives.length, originalArray.primitives.length);
    });

    test('should handle storage failures gracefully', async () => {
        const obj = new MockMementoObject('storage-failure-test');
        
        
        // Simulate storage failure
        storage.setThrowOnSave(true);
        
        try {
            await system.registerObject(obj); // Auto-save is enabled
            assert.fail('Should have thrown an error');
        } catch (error) {
            assert.ok(error instanceof Error);
        }
        
        // Object should still be registered
        assert.strictEqual(system.isMementoRegistered('storage-failure-test'), true);
        assert.strictEqual(system.isMementoSaved('storage-failure-test'), false);
    });

    test('should handle concurrent operations', async () => {
        const obj1 = new MockMementoObject('concurrent-1');
        const obj2 = new MockMementoObject('concurrent-2');
        const obj3 = new MockMementoObject('concurrent-3');

        // Simulate concurrent registrations
        const promises = [
            system.registerObject(obj1),
            system.registerObject(obj2),
            system.registerObject(obj3)
        ];

        const results = await Promise.all(promises);

        // All should succeed
        results.forEach(result => {
            assert.strictEqual(result.success, true);
        });

        // All should be registered and saved (auto-save enabled)
        assert.strictEqual(system.getRegisteredMementoIds().length, 3);
        assert.strictEqual(system.getSavedMementoIds().length, 3);
    });

    test('should maintain referential integrity across saves and loads', async () => {
        const child = new MockMementoObject('ref-integrity-child');
        const parent = new MockMementoObjectWithReferences(
            'ref-integrity-parent',
            'Parent',
            child
        );

        await system.registerObject(parent, { autoRegister: true });

        // Load both objects
        const parentMemento = await system.loadMemento('ref-integrity-parent');
        const childMemento = await system.loadMemento('ref-integrity-child');

        assert.ok(parentMemento);
        assert.ok(childMemento);
        
        // Parent should reference child by ID
        assert.strictEqual(parentMemento.references.relatedObject, 'ref-integrity-child');
        assert.strictEqual(childMemento.id, 'ref-integrity-child');
    });

    test('should handle system lifecycle correctly', async () => {
        // Add some data
        const obj1 = new MockMementoObject('lifecycle-1');
        const obj2 = new MockMementoObject('lifecycle-2');

        await system.registerObject(obj1);
        await system.registerObject(obj2);

        assert.strictEqual(system.getState(), MementoSystemState.Ready);
        assert.strictEqual(system.getRegisteredMementoIds().length, 2);

        // Clear everything
        await system.clearAll();

        // Should still be ready but empty
        assert.strictEqual(system.getState(), MementoSystemState.Ready);
        assert.strictEqual(system.getRegisteredMementoIds().length, 0);
        assert.strictEqual(system.getSavedMementoIds().length, 0);
        assert.strictEqual(storage.getStorageSize(), 0);
    });
});
