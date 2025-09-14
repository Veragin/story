import * as assert from 'assert';
import { getObjectTypeName, getEnumerableProperties, hasCircularReference } from '../../../../../../src/code/Visualizer/GUIComponents/MementoSystem/Memento/mementoUtils';
import { MockMementoObject, EmptyMementoObject, ComplexMementoObject } from './MementoTestHelpers';

suite('utils', () => {
    suite('utils - getObjectTypeName', () => {
        test('should return correct type names for primitives', () => {
            assert.strictEqual(getObjectTypeName(null), 'null', 'Should return "null" for null');
            assert.strictEqual(getObjectTypeName(undefined), 'undefined', 'Should return "undefined" for undefined');
        });

        test('should return constructor name for objects', () => {
            const obj = new MockMementoObject('test');
            assert.strictEqual(getObjectTypeName(obj), 'MockMementoObject', 'Should return constructor name');

            const date = new Date();
            assert.strictEqual(getObjectTypeName(date), 'Date', 'Should return Date for Date objects');

            const array: unknown[] = [];
            assert.strictEqual(getObjectTypeName(array), 'Array', 'Should return Array for arrays');
        });

        test('should fallback to toString for objects without constructor name', () => {
            const plainObj = {};
            const result = getObjectTypeName(plainObj);
            assert.strictEqual(result, 'Object', 'Should return Object for plain objects');
        });
    });

    suite('utils - getEnumerableProperties', () => {
        test('should return empty array for object with no properties', () => {
            const obj = new EmptyMementoObject('empty');
            const properties = getEnumerableProperties(obj);

            // Should only have the 'id' property from the constructor
            assert.strictEqual(properties.length, 1, 'Should have one property');
            assert.strictEqual(properties[0].name, 'id', 'Should have id property');
        });

        test('should return all enumerable properties', () => {
            const obj = new MockMementoObject('test', 'name', 42, true);
            const properties = getEnumerableProperties(obj);

            const propertyNames = properties.map(p => p.name);
            assert.ok(propertyNames.includes('id'), 'Should include id property');
            assert.ok(propertyNames.includes('name'), 'Should include name property');
            assert.ok(propertyNames.includes('value'), 'Should include value property');
            assert.ok(propertyNames.includes('isActive'), 'Should include isActive property');
        });

        test('should classify property types correctly', () => {
            const obj = new ComplexMementoObject(
                'test',
                'string',
                42,
                true,
                new Date(),
                null,
                undefined,
                { nested: 'object' }
            );
            const properties = getEnumerableProperties(obj);

            const stringProp = properties.find(p => p.name === 'stringProp');
            const numberProp = properties.find(p => p.name === 'numberProp');
            const nestedProp = properties.find(p => p.name === 'nestedObject');

            assert.strictEqual(stringProp?.type, 0, 'String should be classified as Primitive'); // PropertyType.Primitive = 0
            assert.strictEqual(numberProp?.type, 0, 'Number should be classified as Primitive');
            assert.strictEqual(nestedProp?.type, 3, 'Nested object should be classified as PlainObject'); // PropertyType.PlainObject = 3
        });
    });

    suite('utils - hasCircularReference', () => {
        test('should detect circular reference', () => {
            const obj = {};
            const visited = new Set([obj]);

            const result = hasCircularReference(obj, visited);

            assert.strictEqual(result, true, 'Should detect circular reference');
        });

        test('should not detect non-circular reference', () => {
            const obj1 = {};
            const obj2 = {};
            const visited = new Set([obj1]);

            const result = hasCircularReference(obj2, visited);

            assert.strictEqual(result, false, 'Should not detect circular reference for different objects');
        });

        test('should handle empty visited set', () => {
            const obj = {};
            const visited = new Set();

            const result = hasCircularReference(obj, visited);

            assert.strictEqual(result, false, 'Should not detect circular reference with empty visited set');
        });
    });
});