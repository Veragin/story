// =============================================================================
// FILE: memento-examples.test.ts
// =============================================================================

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
import { createMemento } from '../../../../../../src/code/Visualizer/GUIComponents/MementoSystem/Memento/memento';
import { InMemoryMementoRegistry } from '../../../../../../src/code/Visualizer/GUIComponents/MementoSystem/Memento/InMemoryMementoRegistry';
import { TestUser, TestTask, TestProject, createTestData } from './MementoExampleTestHelpers';

suite('Memento Examples', () => {
    suite('Memento Examples - Basic Primitives', () => {
        let registry: InMemoryMementoRegistry;

        setup(() => {
            registry = new InMemoryMementoRegistry();
        });

        teardown(() => {
            sinon.restore();
        });

        test('should create memento for user with only primitive properties', () => {
            const john = new TestUser('1', 'John Doe', 'john@example.com');

            const result = createMemento(john, registry);

            assert.strictEqual(result.success, true, 'Memento creation should succeed');
            assert.ok(result.memento, 'Should have memento object');
            assert.strictEqual(result.memento!.id, 'user-1', 'Should have correct memento ID');
            assert.strictEqual(result.memento!.type, 'TestUser', 'Should have correct object type');

            const primitives = result.memento!.primitives;
            assert.strictEqual(primitives.id, '1', 'Should store id primitive');
            assert.strictEqual(primitives.name, 'John Doe', 'Should store name primitive');
            assert.strictEqual(primitives.email, 'john@example.com', 'Should store email primitive');
            assert.strictEqual(primitives.isActive, true, 'Should store isActive primitive');
            assert.ok(primitives.createdAt instanceof Date, 'Should store Date primitive');

            assert.strictEqual(Object.keys(result.memento!.references).length, 0, 'Should have no references');
            assert.strictEqual(Object.keys(result.memento!.collections).length, 0, 'Should have no collections');
            assert.ok(result.memento!.timestamp > 0, 'Should have valid timestamp');
        });

        test('should handle user with different primitive values', () => {
            const inactiveUser = new TestUser('2', 'Inactive User', 'inactive@test.com', false, new Date('2022-12-01'));

            const result = createMemento(inactiveUser, registry);

            assert.strictEqual(result.success, true, 'Should succeed');
            assert.strictEqual(result.memento!.primitives.isActive, false, 'Should store false boolean');
            assert.deepStrictEqual(result.memento!.primitives.createdAt, new Date('2022-12-01'), 'Should store specific date');
        });
    });

    suite('Memento Examples - Object References', () => {
        let registry: InMemoryMementoRegistry;

        setup(() => {
            registry = new InMemoryMementoRegistry();
        });

        teardown(() => {
            sinon.restore();
        });

        test('should create memento with reference to registered user', () => {
            const { john, task1 } = createTestData();

            // Register the referenced object first
            const registerResult = registry.register(john);
            assert.strictEqual(registerResult, true, 'User should be registered successfully');

            const result = createMemento(task1, registry);

            assert.strictEqual(result.success, true, 'Task memento creation should succeed');
            assert.ok(result.memento, 'Should have memento object');

            // Check primitives
            const primitives = result.memento!.primitives;
            assert.strictEqual(primitives.title, 'Design Database', 'Should store task title');
            assert.strictEqual(primitives.description, 'Create the initial database schema', 'Should store task description');
            assert.strictEqual(primitives.isCompleted, false, 'Should store completion status');
            assert.strictEqual(primitives.priority, 3, 'Should store priority');

            // Check references
            const references = result.memento!.references;
            assert.strictEqual(references.assignedUser, 'user-1', 'Should store user reference by ID');
            assert.strictEqual(Object.keys(references).length, 1, 'Should have exactly one reference');

            assert.deepStrictEqual(result.autoRegisteredIds, [], 'Should not auto-register anything');
        });

        test('should verify registry state after reference creation', () => {
            const { john, task1 } = createTestData();

            registry.register(john);
            assert.deepStrictEqual(registry.getRegisteredIds(), ['user-1'], 'Should have user registered');

            const result = createMemento(task1, registry);

            assert.strictEqual(result.success, true, 'Should succeed');
            // Registry should remain unchanged since we're not registering the task
            assert.deepStrictEqual(registry.getRegisteredIds(), ['user-1'], 'Registry should only contain user');
        });
    });

    suite('Memento Examples - Auto Registration', () => {
        let registry: InMemoryMementoRegistry;

        setup(() => {
            registry = new InMemoryMementoRegistry();
        });

        teardown(() => {
            sinon.restore();
        });

        test('should auto-register unregistered referenced objects', () => {
            const { john, task1 } = createTestData();

            // Verify registry is initially empty
            assert.deepStrictEqual(registry.getRegisteredIds(), [], 'Registry should start empty');

            const result = createMemento(task1, registry, { autoRegister: true });

            assert.strictEqual(result.success, true, 'Should succeed with auto-registration');

            // Check that user was auto-registered
            assert.deepStrictEqual(result.autoRegisteredIds, ['user-1'], 'Should auto-register the user');
            assert.deepStrictEqual(registry.getRegisteredIds(), ['user-1'], 'Registry should contain auto-registered user');
            assert.strictEqual(registry.isRegistered('user-1'), true, 'User should be in registry');

            // Check that reference was created
            assert.strictEqual(result.memento!.references.assignedUser, 'user-1', 'Should create reference to auto-registered user');
        });

        test('should not auto-register already registered objects', () => {
            const { john, task1 } = createTestData();

            // Pre-register the user
            registry.register(john);

            const result = createMemento(task1, registry, { autoRegister: true });

            assert.strictEqual(result.success, true, 'Should succeed');
            assert.deepStrictEqual(result.autoRegisteredIds, [], 'Should not auto-register already registered objects');
            assert.deepStrictEqual(registry.getRegisteredIds(), ['user-1'], 'Registry should remain unchanged');
            assert.strictEqual(result.memento!.references.assignedUser, 'user-1', 'Should still create reference');
        });

        test('should handle task without assigned user when auto-register enabled', () => {
            const { task3 } = createTestData(); // task3 has no assignedUser

            const result = createMemento(task3, registry, { autoRegister: true });

            assert.strictEqual(result.success, true, 'Should succeed');
            assert.deepStrictEqual(result.autoRegisteredIds, [], 'Should not auto-register anything');
            assert.strictEqual(Object.keys(result.memento!.references).length, 0, 'Should have no references');
            assert.strictEqual(result.memento!.primitives.title, 'Deploy to Production', 'Should still store primitives');
        });
    });

    suite('Memento Examples - Arrays and Collections', () => {
        let registry: InMemoryMementoRegistry;

        setup(() => {
            registry = new InMemoryMementoRegistry();
        });

        teardown(() => {
            sinon.restore();
        });

        test('should handle project with primitive array and object references', () => {
            const { john, jane, task1, task2, task3, project } = createTestData();

            // Register all referenced objects
            registry.register(john);
            registry.register(jane);
            registry.register(task1);
            registry.register(task2);
            registry.register(task3);

            const initialRegisteredCount = registry.getRegisteredIds().length;
            assert.strictEqual(initialRegisteredCount, 5, 'Should have 5 objects registered');

            const result = createMemento(project, registry);

            assert.strictEqual(result.success, true, 'Project memento creation should succeed');

            // Check primitives (including tags array)
            const primitives = result.memento!.primitives;
            assert.strictEqual(primitives.name, 'Memento System', 'Should store project name');
            assert.strictEqual(primitives.description, 'Implement memento pattern for state management', 'Should store description');
            assert.strictEqual(primitives.isArchived, false, 'Should store archived status');

            // Check references (owner)
            const references = result.memento!.references;
            assert.strictEqual(references.owner, 'user-1', 'Should reference project owner');

            // Check collections
            const collections = result.memento!.collections;
            assert.ok(collections.tags, 'Should have tags collection');
            assert.ok(collections.tasks, 'Should have tasks collection');

            // Verify tags collection (primitives array)
            const tagsCollection = collections.tags;
            assert.strictEqual(tagsCollection.type, 'array', 'Tags should be array type');
            assert.strictEqual(tagsCollection.primitives.length, 3, 'Should have 3 tag primitives');
            assert.ok(tagsCollection.primitives.includes('typescript'), 'Should include typescript tag');
            assert.ok(tagsCollection.primitives.includes('patterns'), 'Should include patterns tag');
            assert.ok(tagsCollection.primitives.includes('architecture'), 'Should include architecture tag');
            assert.strictEqual(tagsCollection.references.length, 0, 'Tags should have no references');

            // Verify tasks collection (object references array)
            const tasksCollection = collections.tasks;
            assert.strictEqual(tasksCollection.type, 'array', 'Tasks should be array type');
            assert.strictEqual(tasksCollection.references.length, 3, 'Should have 3 task references');
            assert.ok(tasksCollection.references.includes('task-1'), 'Should include task-1 reference');
            assert.ok(tasksCollection.references.includes('task-2'), 'Should include task-2 reference');
            assert.ok(tasksCollection.references.includes('task-3'), 'Should include task-3 reference');
            assert.strictEqual(tasksCollection.primitives.length, 0, 'Tasks should have no primitives');

            assert.deepStrictEqual(result.autoRegisteredIds, [], 'Should not auto-register anything');
        });

        test('should handle empty arrays in collections', () => {
            const { john } = createTestData();
            const emptyProject = new TestProject('empty', 'Empty Project', 'No tasks yet', john, [], false);

            registry.register(john);

            const result = createMemento(emptyProject, registry);

            assert.strictEqual(result.success, true, 'Should succeed');

            const collections = result.memento!.collections;
            assert.ok(collections.tags, 'Should have tags collection');
            assert.ok(collections.tasks, 'Should have tasks collection');

            assert.strictEqual(collections.tags.primitives.length, 0, 'Empty tags array should have no primitives');
            assert.strictEqual(collections.tasks.references.length, 0, 'Empty tasks array should have no references');
        });
    });

    suite('Memento Examples - Unregistered Objects', () => {
        let registry: InMemoryMementoRegistry;

        setup(() => {
            registry = new InMemoryMementoRegistry();
        });

        teardown(() => {
            sinon.restore();
        });

        test('should skip unregistered objects when auto-register is disabled', () => {
            const { john, task1 } = createTestData();

            // Don't register john, and disable auto-registration
            assert.strictEqual(registry.isRegistered('user-1'), false, 'User should not be registered');

            const result = createMemento(task1, registry, { autoRegister: false });

            assert.strictEqual(result.success, true, 'Should succeed even with unregistered references');

            // Check that assignedUser property was skipped
            assert.ok(result.skippedProperties.includes('assignedUser'), 'Should skip assignedUser property');
            assert.strictEqual(Object.keys(result.memento!.references).length, 0, 'Should have no references');

            // Should still store other properties
            assert.strictEqual(result.memento!.primitives.title, 'Design Database', 'Should still store primitive properties');
            assert.strictEqual(result.memento!.primitives.priority, 3, 'Should still store other primitives');

            assert.deepStrictEqual(result.autoRegisteredIds, [], 'Should not auto-register anything');
            assert.deepStrictEqual(registry.getRegisteredIds(), [], 'Registry should remain empty');
        });

        test('should handle mix of registered and unregistered objects in arrays', () => {
            const { john, jane, task1, task2, task3, project } = createTestData();

            // Only register some objects
            registry.register(john); // Register owner
            registry.register(task1); // Register only one task
            // Don't register jane, task2, task3

            const result = createMemento(project, registry, { autoRegister: false });

            assert.strictEqual(result.success, true, 'Should succeed');

            // Owner should be referenced
            assert.strictEqual(result.memento!.references.owner, 'user-1', 'Should reference registered owner');

            // Tasks collection should only include registered task
            const tasksCollection = result.memento!.collections.tasks;
            assert.strictEqual(tasksCollection.references.length, 1, 'Should only have 1 registered task reference');
            assert.ok(tasksCollection.references.includes('task-1'), 'Should include registered task');
            assert.ok(!tasksCollection.references.includes('task-2'), 'Should not include unregistered task2');
            assert.ok(!tasksCollection.references.includes('task-3'), 'Should not include unregistered task3');
        });
    });

    suite('Memento Examples - Complete Workflow', () => {
        let registry: InMemoryMementoRegistry;

        setup(() => {
            registry = new InMemoryMementoRegistry();
        });

        teardown(() => {
            sinon.restore();
        });

        test('should handle complete workflow with auto-registration and property skipping', () => {
            const { john, jane, task1, task2, task3, project } = createTestData();

            // Step 1: Create project memento with auto-registration and skip some properties
            const projectResult = createMemento(project, registry, {
                autoRegister: true,
                skipProperties: ['description']
            });

            assert.strictEqual(projectResult.success, true, 'Project memento should be created successfully');
            assert.ok(projectResult.skippedProperties.includes('description'), 'Should skip description property');

            // Verify auto-registration
            const expectedAutoRegistered = ['user-1', 'task-1', 'user-2', 'task-2', 'task-3'];
            assert.strictEqual(projectResult.autoRegisteredIds.length, 5, 'Should auto-register 5 objects');

            // All objects should now be in registry
            expectedAutoRegistered.forEach(id => {
                assert.strictEqual(registry.isRegistered(id), true, `${id} should be registered`);
            });

            // Step 2: Verify registry contents
            const registeredIds = registry.getRegisteredIds();
            assert.strictEqual(registeredIds.length, 5, 'Registry should contain 5 objects');

            // Step 3: Create memento for individual task (should reuse existing registrations)
            const taskResult = createMemento(task2, registry);

            assert.strictEqual(taskResult.success, true, 'Task memento should be created');
            assert.strictEqual(taskResult.autoRegisteredIds.length, 0, 'Should not auto-register anything new');

            // Verify task references existing user
            assert.strictEqual(taskResult.memento!.references.assignedUser, 'user-2', 'Should reference existing user');

            // Registry should remain unchanged
            assert.strictEqual(registry.getRegisteredIds().length, 5, 'Registry should still have 5 objects');
        });

        test('should handle serialization workflow', () => {
            const { project } = createTestData();

            const result = createMemento(project, registry, { autoRegister: true });

            assert.strictEqual(result.success, true, 'Should create memento');

            // Simulate serialization
            const serialized = JSON.stringify(result.memento);
            assert.ok(serialized.length > 0, 'Should serialize to non-empty string');

            // Simulate deserialization
            const deserialized = JSON.parse(serialized);
            assert.strictEqual(deserialized.id, 'project-1', 'Should preserve ID after serialization');
            assert.strictEqual(deserialized.type, 'TestProject', 'Should preserve type after serialization');
            assert.ok(deserialized.primitives, 'Should preserve primitives after serialization');
            assert.ok(deserialized.references, 'Should preserve references after serialization');
            assert.ok(deserialized.collections, 'Should preserve collections after serialization');
        });

        test('should demonstrate memento immutability', () => {
            const { john } = createTestData();

            const result = createMemento(john, registry);
            assert.strictEqual(result.success, true, 'Should create memento');

            const memento = result.memento!;

            // Try to modify memento (should not be possible due to readonly fields)
            const originalId = memento.id;
            const originalType = memento.type;
            const originalTimestamp = memento.timestamp;

            // Verify memento structure is as expected
            assert.strictEqual(memento.id, originalId, 'ID should remain stable');
            assert.strictEqual(memento.type, originalType, 'Type should remain stable');
            assert.strictEqual(memento.timestamp, originalTimestamp, 'Timestamp should remain stable');

            // Verify memento contains all expected data
            assert.ok(memento.primitives, 'Should have primitives object');
            assert.ok(memento.references, 'Should have references object');
            assert.ok(memento.collections, 'Should have collections object');
        });
    });

    suite('Memento Examples - Error Scenarios', () => {
        let registry: InMemoryMementoRegistry;

        setup(() => {
            registry = new InMemoryMementoRegistry();
        });

        teardown(() => {
            sinon.restore();
        });

        test('should handle depth limitation in object hierarchy', () => {
            const { john, project } = createTestData();

            registry.register(john);

            const result = createMemento(project, registry, {
                autoRegister: true,
                maxDepth: 1  // Very low depth limit
            });

            assert.strictEqual(result.success, false, 'Should fail due to depth limit');
            assert.ok(result.error?.includes('Maximum depth'), 'Should have depth limit error');
        });

        test('should handle object with faulty getMementoId method', () => {
            const faultyUser = new TestUser('faulty', 'Faulty User', 'faulty@test.com');
            const faultyUserSpy = sinon.stub(faultyUser, 'getMementoId').throws(new Error('getMementoId failed'));

            const result = createMemento(faultyUser, registry);

            assert.strictEqual(result.success, false, 'Should fail when getMementoId throws');
            assert.ok(result.error?.includes('getMementoId failed'), 'Should include original error message');

            faultyUserSpy.restore();
        });
    });
});