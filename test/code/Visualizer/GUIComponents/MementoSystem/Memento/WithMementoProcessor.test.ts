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
import { WithMementoProcessor } from '../../../../../../src/code/Visualizer/GUIComponents/MementoSystem/Memento/processors/WithMementoProcessor';
import { InMemoryMementoRegistry } from '../../../../../../src/code/Visualizer/GUIComponents/MementoSystem/Memento/InMemoryMementoRegistry';
import { MementoContext } from '../../../../../../src/code/Visualizer/GUIComponents/MementoSystem/Memento/mementoTypes';
import { MockMementoObject, MockMementoObjectWithReferences } from './MementoTestHelpers';

suite('WithMementoProcessor', () => {
    suite('WithMementoProcessor - canProcess', () => {
        let processor: WithMementoProcessor;

        setup(() => {
            processor = new WithMementoProcessor();
        });

        test('should process WithMemento objects', () => {
            const mementoObj = new MockMementoObject('test');
            assert.strictEqual(processor.canProcess(mementoObj), true, 'Should process WithMemento object');
        });

        test('should not process non-WithMemento objects', () => {
            assert.strictEqual(processor.canProcess('string'), false, 'Should not process string');
            assert.strictEqual(processor.canProcess(42), false, 'Should not process number');
            assert.strictEqual(processor.canProcess({}), false, 'Should not process plain object');
            assert.strictEqual(processor.canProcess([]), false, 'Should not process array');
            assert.strictEqual(processor.canProcess(null), false, 'Should not process null');
        });
    });

    suite('WithMementoProcessor - process with registered objects', () => {
        let processor: WithMementoProcessor;
        let registry: InMemoryMementoRegistry;
        let context: MementoContext;

        setup(() => {
            processor = new WithMementoProcessor();
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

        test('should include reference for registered objects', () => {
            const relatedObj = new MockMementoObject('related-obj');
            registry.register(relatedObj);

            const result = processor.process('relatedProp', relatedObj, context);

            assert.strictEqual(result.shouldInclude, true, 'Should include registered object');
            assert.strictEqual(result.referenceId, 'related-obj', 'Should return correct reference ID');
            assert.deepStrictEqual(result.newlyRegistered, [], 'Should not have newly registered objects');
            assert.strictEqual(result.primitiveValue, undefined, 'Should not have primitive value');
            assert.strictEqual(result.collection, undefined, 'Should not have collection');
        });

        test('should skip unregistered objects when autoRegister is false', () => {
            const unregisteredObj = new MockMementoObject('unregistered');

            const result = processor.process('unregisteredProp', unregisteredObj, context);

            assert.strictEqual(result.shouldInclude, false, 'Should not include unregistered object');
            assert.strictEqual(result.referenceId, undefined, 'Should not have reference ID');
            assert.deepStrictEqual(result.newlyRegistered, [], 'Should not have newly registered objects');
        });
    });

    suite('WithMementoProcessor - process with auto-registration', () => {
        let processor: WithMementoProcessor;
        let registry: InMemoryMementoRegistry;
        let context: MementoContext;

        setup(() => {
            processor = new WithMementoProcessor();
            registry = new InMemoryMementoRegistry();
            context = {
                registry,
                options: { autoRegister: true, maxDepth: 10, skipProperties: [] },
                visitedObjects: new Set(),
                currentDepth: 0
            };
        });

        teardown(() => {
            sinon.restore();
        });

        test('should auto-register and include unregistered objects', () => {
            const unregisteredObj = new MockMementoObject('auto-register-test');

            const result = processor.process('newProp', unregisteredObj, context);

            assert.strictEqual(result.shouldInclude, true, 'Should include auto-registered object');
            assert.strictEqual(result.referenceId, 'auto-register-test', 'Should return correct reference ID');
            assert.deepStrictEqual(result.newlyRegistered, ['auto-register-test'], 'Should track newly registered object');
            assert.strictEqual(registry.isRegistered('auto-register-test'), true, 'Object should be registered in registry');
        });

        test('should not auto-register already registered objects', () => {
            const alreadyRegistered = new MockMementoObject('already-registered');
            registry.register(alreadyRegistered);

            const result = processor.process('existingProp', alreadyRegistered, context);

            assert.strictEqual(result.shouldInclude, true, 'Should include already registered object');
            assert.strictEqual(result.referenceId, 'already-registered', 'Should return correct reference ID');
            assert.deepStrictEqual(result.newlyRegistered, [], 'Should not track already registered object');
        });

        test('should handle registration failures gracefully', () => {
            const obj1 = new MockMementoObject('duplicate-id');
            const obj2 = new MockMementoObject('duplicate-id'); // Same ID

            registry.register(obj1); // Register first object

            const result = processor.process('duplicateProp', obj2, context);

            assert.strictEqual(result.shouldInclude, true, 'Should still include object with duplicate ID');
            assert.strictEqual(result.referenceId, 'duplicate-id', 'Should return the ID');
            assert.deepStrictEqual(result.newlyRegistered, [], 'Should not track failed registration');
        });
    });

    suite('WithMementoProcessor - error handling', () => {
        let processor: WithMementoProcessor;
        let registry: InMemoryMementoRegistry;
        let context: MementoContext;

        setup(() => {
            processor = new WithMementoProcessor();
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

        test('should throw error for non-WithMemento values', () => {
            assert.throws(
                () => processor.process('invalidProp', 'not-a-memento-object', context),
                /WithMementoProcessor cannot process non-WithMemento value/,
                'Should throw error for non-WithMemento value'
            );
        });

        test('should handle getMementoId errors gracefully', () => {
            const faultyObj = new MockMementoObject('faulty');
            faultyObj.getMementoIdSpy.throws(new Error('getMementoId failed'));

            assert.throws(
                () => processor.process('faultyProp', faultyObj, context),
                /getMementoId failed/,
                'Should propagate getMementoId errors'
            );
        });
    });
});