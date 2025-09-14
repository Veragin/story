import * as assert from 'assert';
import * as sinon from 'sinon';
import { createMemento } from '../../../../../../src/code/Visualizer/GUIComponents/MementoSystem/Memento/memento';
import { InMemoryMementoRegistry } from '../../../../../../src/code/Visualizer/GUIComponents/MementoSystem/Memento/InMemoryMementoRegistry';
import { MockMementoObject, EmptyMementoObject, ComplexMementoObject } from './MementoTestHelpers';

suite('createMemento', () => {
    suite('createMemento - Input Validation', () => {
        let registry: InMemoryMementoRegistry;

        setup(() => {
            registry = new InMemoryMementoRegistry();
        });

        teardown(() => {
            sinon.restore();
        });

        test('should reject null object', () => {
            const result = createMemento(null as any, registry);

            assert.strictEqual(result.success, false, 'Should fail with null object');
            assert.strictEqual(result.error, 'Object cannot be null or undefined', 'Should have appropriate error message');
            assert.deepStrictEqual(result.skippedProperties, [], 'Should have empty skipped properties');
            assert.deepStrictEqual(result.autoRegisteredIds, [], 'Should have empty auto-registered IDs');
        });

        test('should reject undefined object', () => {
            const result = createMemento(undefined as any, registry);

            assert.strictEqual(result.success, false, 'Should fail with undefined object');
            assert.strictEqual(result.error, 'Object cannot be null or undefined', 'Should have appropriate error message');
        });

        test('should reject non-WithMemento object', () => {
            const plainObject = { id: 'test', name: 'plain' };
            const result = createMemento(plainObject as any, registry);

            assert.strictEqual(result.success, false, 'Should fail with non-WithMemento object');
            assert.strictEqual(result.error, 'Object must implement WithMemento interface', 'Should have appropriate error message');
        });
    });

    suite('createMemento - Basic Primitive Properties', () => {
        let registry: InMemoryMementoRegistry;

        setup(() => {
            registry = new InMemoryMementoRegistry();
        });

        teardown(() => {
            sinon.restore();
        });

        test('should create memento for object with only primitive properties', () => {
            const obj = new MockMementoObject('test-obj', 'testName', 100, false, new Date('2023-06-15'), 'description', 42);

            const result = createMemento(obj, registry);

            assert.strictEqual(result.success, true, 'Should succeed');
            assert.ok(result.memento, 'Should have memento');
            assert.strictEqual(result.memento!.id, 'test-obj', 'Should have correct ID');
            assert.strictEqual(result.memento!.type, 'MockMementoObject', 'Should have correct type');

            const primitives = result.memento!.primitives;
            assert.strictEqual(primitives.id, 'test-obj', 'Should store id property');
            assert.strictEqual(primitives.name, 'testName', 'Should store string property');
            assert.strictEqual(primitives.value, 100, 'Should store number property');
            assert.strictEqual(primitives.isActive, false, 'Should store boolean property');
            assert.deepStrictEqual(primitives.createdAt, new Date('2023-06-15'), 'Should store Date property');
            assert.strictEqual(primitives.description, 'description', 'Should store string property');
            assert.strictEqual(primitives.count, 42, 'Should store number property');
        });

        test('should handle null and undefined primitive values', () => {
            const obj = new MockMementoObject('null-test', 'test', 0, true, new Date(), null, undefined);

            const result = createMemento(obj, registry);

            assert.strictEqual(result.success, true, 'Should succeed with null/undefined values');
            assert.strictEqual(result.memento!.primitives.id, 'null-test', 'Should store id property');
            assert.strictEqual(result.memento!.primitives.description, null, 'Should store null value');
            assert.strictEqual(result.memento!.primitives.count, undefined, 'Should store undefined value');
        });

        test('should create memento for empty object', () => {
            const obj = new EmptyMementoObject('empty-obj');

            const result = createMemento(obj, registry);

            assert.strictEqual(result.success, true, 'Should succeed with empty object');
            assert.strictEqual(result.memento!.id, 'empty-obj', 'Should have correct ID');
            assert.deepStrictEqual(result.memento!.primitives, { id: 'empty-obj' }, 'Should have primitives object with id');
            assert.deepStrictEqual(result.memento!.references, {}, 'Should have empty references object');
            assert.deepStrictEqual(result.memento!.collections, {}, 'Should have empty collections object');
        });

        test('should include timestamp in memento', () => {
            const obj = new MockMementoObject('timestamp-test');
            const beforeTime = Date.now();

            const result = createMemento(obj, registry);

            const afterTime = Date.now();
            assert.ok(result.memento!.timestamp >= beforeTime, 'Timestamp should be after start time');
            assert.ok(result.memento!.timestamp <= afterTime, 'Timestamp should be before end time');
        });
    });

    suite('createMemento - Property Skipping', () => {
        let registry: InMemoryMementoRegistry;

        setup(() => {
            registry = new InMemoryMementoRegistry();
        });

        teardown(() => {
            sinon.restore();
        });

        test('should skip non-primitive properties', () => {
            const obj = new ComplexMementoObject(
                'complex-obj',
                'stringVal',
                42,
                true,
                new Date('2023-01-01'),
                null,
                undefined,
                { nested: 'object' }
            );

            const result = createMemento(obj, registry);

            assert.strictEqual(result.success, true, 'Should succeed');
            assert.ok(result.skippedProperties.includes('nestedObject'), 'Should skip nested object');

            const primitives = result.memento!.primitives;
            assert.strictEqual(primitives.id, 'complex-obj', 'Should include id primitive');
            assert.strictEqual(primitives.stringProp, 'stringVal', 'Should include string primitive');
            assert.strictEqual(primitives.numberProp, 42, 'Should include number primitive');
            assert.strictEqual(primitives.booleanProp, true, 'Should include boolean primitive');
            assert.strictEqual(primitives.nullProp, null, 'Should include null primitive');
            assert.strictEqual(primitives.undefinedProp, undefined, 'Should include undefined primitive');
            assert.ok(!('nestedObject' in primitives), 'Should not include nested object in primitives');
        });

        test('should respect skipProperties option', () => {
            const obj = new MockMementoObject('skip-test', 'name', 100);

            const result = createMemento(obj, registry, {
                skipProperties: ['name', 'value']
            });

            assert.strictEqual(result.success, true, 'Should succeed');
            assert.ok(result.skippedProperties.includes('name'), 'Should skip name property');
            assert.ok(result.skippedProperties.includes('value'), 'Should skip value property');

            const primitives = result.memento!.primitives;
            assert.strictEqual(primitives.id, 'skip-test', 'Should include id property');
            assert.ok(!('name' in primitives), 'Should not include skipped name property');
            assert.ok(!('value' in primitives), 'Should not include skipped value property');
            assert.strictEqual(primitives.isActive, true, 'Should include non-skipped property');
        });
    });

    suite('createMemento - Options and Configuration', () => {
        let registry: InMemoryMementoRegistry;

        setup(() => {
            registry = new InMemoryMementoRegistry();
        });

        teardown(() => {
            sinon.restore();
        });

        test('should use default options when none provided', () => {
            const obj = new MockMementoObject('default-options');

            const result = createMemento(obj, registry);

            assert.strictEqual(result.success, true, 'Should succeed with default options');
            assert.deepStrictEqual(result.autoRegisteredIds, [], 'Should have empty auto-registered IDs with default options');
        });

        test('should merge partial options with defaults', () => {
            const obj = new MockMementoObject('partial-options');

            const result = createMemento(obj, registry, {
                skipProperties: ['name']
            });

            assert.strictEqual(result.success, true, 'Should succeed with partial options');
            assert.ok(result.skippedProperties.includes('name'), 'Should apply skipProperties option');
        });

        test('should handle maximum depth limitation', () => {
            const obj = new MockMementoObject('depth-test');

            const result = createMemento(obj, registry, {
                maxDepth: 0
            });

            // With maxDepth 0, the initial object itself should exceed the depth limit
            assert.strictEqual(result.success, false, 'Should fail when depth limit exceeded');
            assert.ok(result.error?.includes('Maximum depth'), 'Should have depth-related error message');
        });
    });

    suite('createMemento - Error Handling', () => {
        let registry: InMemoryMementoRegistry;

        setup(() => {
            registry = new InMemoryMementoRegistry();
        });

        teardown(() => {
            sinon.restore();
        });

        test('should handle getMementoId throwing error', () => {
            const obj = new MockMementoObject('error-test');
            obj.getMementoIdSpy.throws(new Error('getMementoId failed'));

            const result = createMemento(obj, registry);

            assert.strictEqual(result.success, false, 'Should fail when getMementoId throws');
            assert.ok(result.error?.includes('getMementoId failed'), 'Should include original error message');
        });

        test('should handle unknown errors gracefully', () => {
            const obj = new MockMementoObject('unknown-error');
            obj.getMementoIdSpy.callsFake(() => {
                throw 'string error'; // Throw a non-Error object directly
            });

            const result = createMemento(obj, registry);

            assert.strictEqual(result.success, false, 'Should fail gracefully');
            assert.strictEqual(result.error, 'Unknown error occurred', 'Should have generic error message for non-Error objects');
        });
    });
});