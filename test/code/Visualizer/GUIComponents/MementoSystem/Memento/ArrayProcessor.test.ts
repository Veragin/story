import * as assert from 'assert';
import * as sinon from 'sinon';
import { ArrayProcessor } from '../../../../../../src/code/Visualizer/GUIComponents/MementoSystem/Memento/processors/ArrayProcessor';
import { InMemoryMementoRegistry } from '../../../../../../src/code/Visualizer/GUIComponents/MementoSystem/Memento/InMemoryMementoRegistry';
import { MementoContext } from '../../../../../../src/code/Visualizer/GUIComponents/MementoSystem/Memento/mementoTypes';
import { MockMementoObject } from './MementoTestHelpers';

suite('ArrayProcessor', () => {
    suite('ArrayProcessor - canProcess', () => {
        let processor: ArrayProcessor;

        setup(() => {
            processor = new ArrayProcessor();
        });

        test('should process arrays', () => {
            assert.strictEqual(processor.canProcess([]), true, 'Should process empty array');
            assert.strictEqual(processor.canProcess([1, 2, 3]), true, 'Should process number array');
            assert.strictEqual(processor.canProcess(['a', 'b']), true, 'Should process string array');
            assert.strictEqual(processor.canProcess([{}]), true, 'Should process object array');
        });

        test('should not process non-arrays', () => {
            assert.strictEqual(processor.canProcess('string'), false, 'Should not process string');
            assert.strictEqual(processor.canProcess(42), false, 'Should not process number');
            assert.strictEqual(processor.canProcess({}), false, 'Should not process object');
            assert.strictEqual(processor.canProcess(null), false, 'Should not process null');
        });
    });

    suite('ArrayProcessor - process', () => {
        let processor: ArrayProcessor;
        let registry: InMemoryMementoRegistry;
        let context: MementoContext;

        setup(() => {
            processor = new ArrayProcessor();
            registry = new InMemoryMementoRegistry();
            context = {
                registry,
                options: { autoRegister: false, maxDepth: 10, skipProperties: [] },
                visitedObjects: new Set(),
                currentDepth: 0
            };
        });

        teardown(() => {
            sinon.restore();
        });

        test('should process array with only primitives', () => {
            const array = ['hello', 42, true, null, undefined, new Date('2023-01-01')];

            const result = processor.process('arrayProp', array, context);

            assert.strictEqual(result.shouldInclude, true, 'Should include array');
            assert.ok(result.collection, 'Should have collection');
            assert.strictEqual(result.collection!.type, 'array', 'Should be array type');

            const primitives = result.collection!.primitives;
            assert.strictEqual(primitives.length, 6, 'Should have 6 primitive elements');
            assert.strictEqual(primitives[0], 'hello', 'Should include string');
            assert.strictEqual(primitives[1], 42, 'Should include number');
            assert.strictEqual(primitives[2], true, 'Should include boolean');
            assert.strictEqual(primitives[3], null, 'Should include null');
            assert.strictEqual(primitives[4], undefined, 'Should include undefined');
            assert.deepStrictEqual(primitives[5], new Date('2023-01-01'), 'Should include Date');

            assert.strictEqual(result.collection!.references.length, 0, 'Should have no references');
        });

        test('should process array with only registered WithMemento objects', () => {
            const obj1 = new MockMementoObject('obj1');
            const obj2 = new MockMementoObject('obj2');
            registry.register(obj1);
            registry.register(obj2);

            const array = [obj1, obj2];

            const result = processor.process('arrayProp', array, context);

            assert.strictEqual(result.shouldInclude, true, 'Should include array');
            assert.ok(result.collection, 'Should have collection');

            const references = result.collection!.references;
            assert.strictEqual(references.length, 2, 'Should have 2 references');
            assert.ok(references.includes('obj1'), 'Should include obj1 reference');
            assert.ok(references.includes('obj2'), 'Should include obj2 reference');

            assert.strictEqual(result.collection!.primitives.length, 0, 'Should have no primitives');
            assert.deepStrictEqual(result.newlyRegistered, [], 'Should not auto-register');
        });

        test('should process mixed array with primitives and WithMemento objects', () => {
            const obj = new MockMementoObject('mixed-obj');
            registry.register(obj);

            const array = ['string', 42, obj, true];

            const result = processor.process('mixedArray', array, context);

            assert.strictEqual(result.shouldInclude, true, 'Should include mixed array');
            assert.ok(result.collection, 'Should have collection');

            const primitives = result.collection!.primitives;
            const references = result.collection!.references;

            assert.strictEqual(primitives.length, 3, 'Should have 3 primitives');
            assert.ok(primitives.includes('string'), 'Should include string primitive');
            assert.ok(primitives.includes(42), 'Should include number primitive');
            assert.ok(primitives.includes(true), 'Should include boolean primitive');

            assert.strictEqual(references.length, 1, 'Should have 1 reference');
            assert.ok(references.includes('mixed-obj'), 'Should include object reference');
        });

        test('should handle auto-registration in arrays', () => {
            const unregisteredObj = new MockMementoObject('unregistered-in-array');
            const array = ['primitive', unregisteredObj];

            const autoRegisterContext = {
                ...context,
                options: { ...context.options, autoRegister: true }
            };

            const result = processor.process('autoRegArray', array, autoRegisterContext);

            assert.strictEqual(result.shouldInclude, true, 'Should include array');
            assert.deepStrictEqual(result.newlyRegistered, ['unregistered-in-array'], 'Should auto-register object');
            assert.strictEqual(registry.isRegistered('unregistered-in-array'), true, 'Object should be registered');

            const references = result.collection!.references;
            assert.ok(references.includes('unregistered-in-array'), 'Should include auto-registered reference');
        });

        test('should skip unregistered objects when auto-register disabled', () => {
            const unregisteredObj = new MockMementoObject('skip-me');
            const array = ['keep-me', unregisteredObj, 42];

            const result = processor.process('skipArray', array, context);

            assert.strictEqual(result.shouldInclude, true, 'Should include array');

            const primitives = result.collection!.primitives;
            assert.strictEqual(primitives.length, 2, 'Should have 2 primitives (skipping unregistered object)');
            assert.ok(primitives.includes('keep-me'), 'Should include string');
            assert.ok(primitives.includes(42), 'Should include number');

            assert.strictEqual(result.collection!.references.length, 0, 'Should have no references');
            assert.deepStrictEqual(result.newlyRegistered, [], 'Should not auto-register');
        });

        test('should handle empty arrays', () => {
            const result = processor.process('emptyArray', [], context);

            assert.strictEqual(result.shouldInclude, true, 'Should include empty array');
            assert.ok(result.collection, 'Should have collection');
            assert.strictEqual(result.collection!.primitives.length, 0, 'Should have no primitives');
            assert.strictEqual(result.collection!.references.length, 0, 'Should have no references');
        });

        test('should throw error for non-array values', () => {
            assert.throws(
                () => processor.process('notArray', 'not an array', context),
                /ArrayProcessor cannot process non-array value/,
                'Should throw error for non-array'
            );
        });
    });
});