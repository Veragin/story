import * as assert from 'assert';
import { PrimitiveProcessor } from '../../../../../../src/code/Visualizer/GUIComponents/MementoSystem/Memento/processors/PrimitiveProcessor';
import { InMemoryMementoRegistry } from '../../../../../../src/code/Visualizer/GUIComponents/MementoSystem/Memento/InMemoryMementoRegistry';
import { MementoContext } from '../../../../../../src/code/Visualizer/GUIComponents/MementoSystem/Memento/mementoTypes';

suite('PrimitiveProcessor', () => {
    suite('PrimitiveProcessor - canProcess', () => {
        let processor: PrimitiveProcessor;

        setup(() => {
            processor = new PrimitiveProcessor();
        });

        test('should process primitive values', () => {
            assert.strictEqual(processor.canProcess('string'), true, 'Should process string');
            assert.strictEqual(processor.canProcess(42), true, 'Should process number');
            assert.strictEqual(processor.canProcess(true), true, 'Should process boolean');
            assert.strictEqual(processor.canProcess(null), true, 'Should process null');
            assert.strictEqual(processor.canProcess(undefined), true, 'Should process undefined');
            assert.strictEqual(processor.canProcess(new Date()), true, 'Should process Date');
        });

        test('should not process non-primitive values', () => {
            assert.strictEqual(processor.canProcess({}), false, 'Should not process object');
            assert.strictEqual(processor.canProcess([]), false, 'Should not process array');
            assert.strictEqual(processor.canProcess(() => { }), false, 'Should not process function');
        });
    });

    suite('PrimitiveProcessor - process', () => {
        let processor: PrimitiveProcessor;
        let context: MementoContext;

        setup(() => {
            processor = new PrimitiveProcessor();
            context = {
                registry: new InMemoryMementoRegistry(),
                options: { autoRegister: false, maxDepth: 10, skipProperties: [] },
                visitedObjects: new Set(),
                currentDepth: 0
            };
        });

        test('should process string values correctly', () => {
            const result = processor.process('testProp', 'hello world', context);

            assert.strictEqual(result.shouldInclude, true, 'Should include string value');
            assert.strictEqual(result.primitiveValue, 'hello world', 'Should return correct string value');
            assert.strictEqual(result.referenceId, undefined, 'Should not have reference ID');
            assert.strictEqual(result.collection, undefined, 'Should not have collection');
            assert.deepStrictEqual(result.newlyRegistered, [], 'Should have empty newly registered array');
        });

        test('should process number values correctly', () => {
            const result = processor.process('numProp', 3.14159, context);

            assert.strictEqual(result.shouldInclude, true, 'Should include number value');
            assert.strictEqual(result.primitiveValue, 3.14159, 'Should return correct number value');
        });

        test('should process boolean values correctly', () => {
            const falseResult = processor.process('boolProp', false, context);
            const trueResult = processor.process('boolProp', true, context);

            assert.strictEqual(falseResult.shouldInclude, true, 'Should include false value');
            assert.strictEqual(falseResult.primitiveValue, false, 'Should return false value');
            assert.strictEqual(trueResult.shouldInclude, true, 'Should include true value');
            assert.strictEqual(trueResult.primitiveValue, true, 'Should return true value');
        });

        test('should process null and undefined correctly', () => {
            const nullResult = processor.process('nullProp', null, context);
            const undefinedResult = processor.process('undefinedProp', undefined, context);

            assert.strictEqual(nullResult.shouldInclude, true, 'Should include null value');
            assert.strictEqual(nullResult.primitiveValue, null, 'Should return null value');
            assert.strictEqual(undefinedResult.shouldInclude, true, 'Should include undefined value');
            assert.strictEqual(undefinedResult.primitiveValue, undefined, 'Should return undefined value');
        });

        test('should process Date values correctly', () => {
            const testDate = new Date('2023-12-25T10:30:00Z');
            const result = processor.process('dateProp', testDate, context);

            assert.strictEqual(result.shouldInclude, true, 'Should include Date value');
            assert.deepStrictEqual(result.primitiveValue, testDate, 'Should return correct Date value');
        });

        test('should throw error for non-primitive values', () => {
            assert.throws(
                () => processor.process('objProp', {}, context),
                /PrimitiveProcessor cannot process non-primitive value/,
                'Should throw error for object'
            );

            assert.throws(
                () => processor.process('arrProp', [], context),
                /PrimitiveProcessor cannot process non-primitive value/,
                'Should throw error for array'
            );
        });
    });
});