import * as assert from 'assert';
import * as sinon from 'sinon';
import { MementoSerializer } from '../../../../../src/code/Visualizer/GUIComponents/MementoSystem/MementoSerializer';
import { MementoRecord } from '../../../../../src/code/Visualizer/GUIComponents/MementoSystem/Memento/mementoTypes';

suite('MementoSerializer', () => {
    let serializer: MementoSerializer;

    setup(() => {
        serializer = new MementoSerializer();
    });

    teardown(() => {
        sinon.restore();
    });

    suite('serialize', () => {
        test('should serialize basic memento record', () => {
            const memento: MementoRecord = {
                id: 'test-123',
                type: 'TestType',
                primitives: { name: 'test', value: 42 },
                references: { related: 'ref-456' },
                collections: { items: { type: 'array', primitives: [1, 2, 3], references: [] } },
                timestamp: 1640995200000
            };

            const json = serializer.serialize(memento);
            const parsed = JSON.parse(json);

            assert.strictEqual(parsed.id, 'test-123');
            assert.strictEqual(parsed.type, 'TestType');
            assert.deepStrictEqual(parsed.primitives, { name: 'test', value: 42 });
            assert.deepStrictEqual(parsed.references, { related: 'ref-456' });
            assert.strictEqual(parsed.timestamp, 1640995200000);
        });

        test('should serialize Date objects in primitives', () => {
            const testDate = new Date('2023-01-01T10:00:00.000Z');
            const memento: MementoRecord = {
                id: 'date-test',
                type: 'DateTest',
                primitives: { createdAt: testDate, name: 'test' },
                references: {},
                collections: {},
                timestamp: Date.now()
            };

            const json = serializer.serialize(memento);
            const parsed = JSON.parse(json);

            assert.strictEqual(parsed.primitives.createdAt.__type, 'Date');
            assert.strictEqual(parsed.primitives.createdAt.value, testDate.toISOString());
            assert.strictEqual(parsed.primitives.name, 'test');
        });

        test('should handle empty collections and references', () => {
            const memento: MementoRecord = {
                id: 'empty-test',
                type: 'EmptyTest',
                primitives: {},
                references: {},
                collections: {},
                timestamp: Date.now()
            };

            const json = serializer.serialize(memento);
            
            assert.doesNotThrow(() => JSON.parse(json));
            const parsed = JSON.parse(json);
            assert.deepStrictEqual(parsed.references, {});
            assert.deepStrictEqual(parsed.collections, {});
        });
    });

    suite('deserialize', () => {
        test('should deserialize basic memento record', () => {
            const json = JSON.stringify({
                id: 'deserialize-test',
                type: 'DeserializeTest',
                primitives: { name: 'test', value: 42 },
                references: { related: 'ref-789' },
                collections: { items: { type: 'array', primitives: [1, 2], references: ['ref1'] } },
                timestamp: 1640995200000
            });

            const memento = serializer.deserialize(json);

            assert.strictEqual(memento.id, 'deserialize-test');
            assert.strictEqual(memento.type, 'DeserializeTest');
            assert.deepStrictEqual(memento.primitives, { name: 'test', value: 42 });
            assert.deepStrictEqual(memento.references, { related: 'ref-789' });
            assert.strictEqual(memento.timestamp, 1640995200000);
        });

        test('should deserialize Date objects in primitives', () => {
            const dateString = '2023-01-01T10:00:00.000Z';
            const json = JSON.stringify({
                id: 'date-deserialize-test',
                type: 'DateDeserializeTest',
                primitives: {
                    createdAt: { __type: 'Date', value: dateString },
                    name: 'test'
                },
                references: {},
                collections: {},
                timestamp: Date.now()
            });

            const memento = serializer.deserialize(json);

            assert.ok(memento.primitives.createdAt instanceof Date);
            assert.strictEqual((memento.primitives.createdAt as Date).toISOString(), dateString);
            assert.strictEqual(memento.primitives.name, 'test');
        });

        test('should throw on invalid JSON', () => {
            const invalidJson = '{ invalid json }';

            assert.throws(() => {
                serializer.deserialize(invalidJson);
            });
        });
    });

    suite('serialize/deserialize roundtrip', () => {
        test('should maintain data integrity through roundtrip', () => {
            const originalMemento: MementoRecord = {
                id: 'roundtrip-test',
                type: 'RoundtripTest',
                primitives: {
                    name: 'test',
                    value: 42,
                    isActive: true,
                    createdAt: new Date('2023-01-01'),
                    nullValue: null
                },
                references: { parent: 'parent-123', child: 'child-456' },
                collections: {
                    items: {
                        type: 'array',
                        primitives: ['a', 'b', 123],
                        references: ['ref1', 'ref2']
                    }
                },
                timestamp: 1640995200000
            };

            const json = serializer.serialize(originalMemento);
            const deserializedMemento = serializer.deserialize(json);

            assert.strictEqual(deserializedMemento.id, originalMemento.id);
            assert.strictEqual(deserializedMemento.type, originalMemento.type);
            assert.strictEqual(deserializedMemento.timestamp, originalMemento.timestamp);
            assert.deepStrictEqual(deserializedMemento.references, originalMemento.references);
            
            // Check primitives except Date
            assert.strictEqual(deserializedMemento.primitives.name, originalMemento.primitives.name);
            assert.strictEqual(deserializedMemento.primitives.value, originalMemento.primitives.value);
            assert.strictEqual(deserializedMemento.primitives.isActive, originalMemento.primitives.isActive);
            assert.strictEqual(deserializedMemento.primitives.nullValue, originalMemento.primitives.nullValue);
            
            // Check Date separately
            const originalDate = originalMemento.primitives.createdAt as Date;
            const deserializedDate = deserializedMemento.primitives.createdAt as Date;
            assert.ok(deserializedDate instanceof Date);
            assert.strictEqual(deserializedDate.toISOString(), originalDate.toISOString());
        });
    });
});
