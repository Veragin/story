import * as assert from 'assert';
import { TypeGuards } from '../../../../../../src/code/Visualizer/GUIComponents/MementoSystem/Memento/TypeGuards';
import { MockMementoObject } from './MementoTestHelpers';

suite('TypeGuards', () => {
    suite('TypeGuards - Primitive Type Detection', () => {
        test('should identify string primitives correctly', () => {
            assert.strictEqual(TypeGuards.isPrimitive('hello'), true, 'String should be primitive');
            assert.strictEqual(TypeGuards.isPrimitive(''), true, 'Empty string should be primitive');
            assert.strictEqual(TypeGuards.isPrimitive('123'), true, 'Numeric string should be primitive');
        });

        test('should identify number primitives correctly', () => {
            assert.strictEqual(TypeGuards.isPrimitive(42), true, 'Integer should be primitive');
            assert.strictEqual(TypeGuards.isPrimitive(3.14), true, 'Float should be primitive');
            assert.strictEqual(TypeGuards.isPrimitive(0), true, 'Zero should be primitive');
            assert.strictEqual(TypeGuards.isPrimitive(-1), true, 'Negative number should be primitive');
            assert.strictEqual(TypeGuards.isPrimitive(NaN), true, 'NaN should be primitive');
            assert.strictEqual(TypeGuards.isPrimitive(Infinity), true, 'Infinity should be primitive');
        });

        test('should identify boolean primitives correctly', () => {
            assert.strictEqual(TypeGuards.isPrimitive(true), true, 'True should be primitive');
            assert.strictEqual(TypeGuards.isPrimitive(false), true, 'False should be primitive');
        });

        test('should identify null and undefined as primitives', () => {
            assert.strictEqual(TypeGuards.isPrimitive(null), true, 'Null should be primitive');
            assert.strictEqual(TypeGuards.isPrimitive(undefined), true, 'Undefined should be primitive');
        });

        test('should identify Date as primitive', () => {
            assert.strictEqual(TypeGuards.isPrimitive(new Date()), true, 'Date should be primitive');
            assert.strictEqual(TypeGuards.isPrimitive(new Date('2023-01-01')), true, 'Specific date should be primitive');
        });

        test('should identify non-primitives correctly', () => {
            assert.strictEqual(TypeGuards.isPrimitive({}), false, 'Object should not be primitive');
            assert.strictEqual(TypeGuards.isPrimitive([]), false, 'Array should not be primitive');
            assert.strictEqual(TypeGuards.isPrimitive(() => { }), false, 'Function should not be primitive');
            assert.strictEqual(TypeGuards.isPrimitive(new MockMementoObject('test')), false, 'Custom object should not be primitive');
        });
    });

    suite('TypeGuards - WithMemento Detection', () => {
        test('should identify WithMemento objects correctly', () => {
            const mementoObj = new MockMementoObject('test');

            assert.strictEqual(TypeGuards.isWithMemento(mementoObj), true, 'Object with getMementoId should be WithMemento');
        });

        test('should reject objects without getMementoId method', () => {
            const plainObj = { id: 'test', name: 'plain' };

            assert.strictEqual(TypeGuards.isWithMemento(plainObj), false, 'Object without getMementoId should not be WithMemento');
        });

        test('should reject objects with non-function getMementoId', () => {
            const badObj = { getMementoId: 'not-a-function' };

            assert.strictEqual(TypeGuards.isWithMemento(badObj), false, 'Object with non-function getMementoId should not be WithMemento');
        });

        test('should reject null and undefined', () => {
            assert.strictEqual(TypeGuards.isWithMemento(null), false, 'Null should not be WithMemento');
            assert.strictEqual(TypeGuards.isWithMemento(undefined), false, 'Undefined should not be WithMemento');
        });

        test('should reject primitives', () => {
            assert.strictEqual(TypeGuards.isWithMemento('string'), false, 'String should not be WithMemento');
            assert.strictEqual(TypeGuards.isWithMemento(42), false, 'Number should not be WithMemento');
            assert.strictEqual(TypeGuards.isWithMemento(true), false, 'Boolean should not be WithMemento');
        });
    });

    suite('TypeGuards - Array Detection', () => {
        test('should identify arrays correctly', () => {
            assert.strictEqual(TypeGuards.isArray([]), true, 'Empty array should be array');
            assert.strictEqual(TypeGuards.isArray([1, 2, 3]), true, 'Number array should be array');
            assert.strictEqual(TypeGuards.isArray(['a', 'b']), true, 'String array should be array');
            assert.strictEqual(TypeGuards.isArray([{}]), true, 'Object array should be array');
        });

        test('should reject non-arrays', () => {
            assert.strictEqual(TypeGuards.isArray({}), false, 'Object should not be array');
            assert.strictEqual(TypeGuards.isArray('string'), false, 'String should not be array');
            assert.strictEqual(TypeGuards.isArray(null), false, 'Null should not be array');
            assert.strictEqual(TypeGuards.isArray(undefined), false, 'Undefined should not be array');
        });
    });

    suite('TypeGuards - Plain Object Detection', () => {
        test('should identify plain objects correctly', () => {
            assert.strictEqual(TypeGuards.isPlainObject({}), true, 'Empty object should be plain object');
            assert.strictEqual(TypeGuards.isPlainObject({ a: 1, b: 2 }), true, 'Simple object should be plain object');
            assert.strictEqual(TypeGuards.isPlainObject(Object.create(null)), true, 'Object with null prototype should be plain object');
        });

        test('should reject non-plain objects', () => {
            assert.strictEqual(TypeGuards.isPlainObject(new MockMementoObject('test')), false, 'Class instance should not be plain object');
            assert.strictEqual(TypeGuards.isPlainObject(new Date()), false, 'Date should not be plain object');
            assert.strictEqual(TypeGuards.isPlainObject([]), false, 'Array should not be plain object');
            assert.strictEqual(TypeGuards.isPlainObject(null), false, 'Null should not be plain object');
            assert.strictEqual(TypeGuards.isPlainObject('string'), false, 'String should not be plain object');
        });
    });
});