import * as assert from 'assert';
import * as sinon from 'sinon';
import { MementoSystem } from '../../../../../src/code/Visualizer/GUIComponents/MementoSystem/MementoSystem';
import { InMemoryMementoRegistry } from '../../../../../src/code/Visualizer/GUIComponents/MementoSystem/Memento/InMemoryMementoRegistry';
import { MementoSystemState } from '../../../../../src/code/Visualizer/GUIComponents/MementoSystem/MementoSystemState';
import { MementoSystemOptions } from '../../../../../src/code/Visualizer/GUIComponents/MementoSystem/MementoSystemOptions';
import { MockMementoObject, MockMementoObjectWithReferences } from './Memento/MementoTestHelpers';
import { MockMementoStorage } from './MockMementoStorage';

suite('MementoSystem', () => {
    let registry: InMemoryMementoRegistry;
    let storage: MockMementoStorage;
    let system: MementoSystem;

    setup(async () => {
        registry = new InMemoryMementoRegistry();
        storage = new MockMementoStorage();
        // Don't create system here since some tests need custom options
    });

    teardown(() => {
        sinon.restore();
    });

    suite('construction and initialization', () => {
        test('should initialize successfully with valid parameters', async () => {
            system = new MementoSystem('test-system', 'Test System', registry, storage);
            
            await system.waitForReady();
            
            assert.strictEqual(system.getId(), 'test-system');
            assert.strictEqual(system.getDescription(), 'Test System');
            assert.strictEqual(system.getState(), MementoSystemState.Ready);
        });

        test('should handle initialization with existing storage data', async () => {
            // Pre-populate storage
            await storage.saveMemento({
                id: 'existing-1',
                type: 'Test',
                primitives: {},
                references: {},
                collections: {},
                timestamp: Date.now()
            });

            system = new MementoSystem('test-system', 'Test System', registry, storage);
            await system.waitForReady();

            const savedIds = system.getSavedMementoIds();
            assert.ok(savedIds.includes('existing-1'), 'Should track existing memento');
        });

        test('should handle storage initialization errors', async () => {
            storage.setThrowOnLoad(true);

            try {
                system = new MementoSystem('error-system', 'Error System', registry, storage);
                await system.waitForReady();
                assert.fail('Should have thrown an error');
            } catch (error) {
                assert.ok(error instanceof Error);
                assert.ok(error.message.includes('error-system'), 'error.message: ' + error.message);
            }
        });

        test('should accept custom options', async () => {
            const options: MementoSystemOptions = {
                autoSave: true,
                validateOnLoad: true,
                defaultMementoOptions: { maxDepth: 5 }
            };

            system = new MementoSystem('options-system', 'Options System', registry, storage, options);
            await system.waitForReady();

            assert.strictEqual(system.getState(), MementoSystemState.Ready);
        });
    });

    suite('object registration', () => {
        setup(async () => {
            system = new MementoSystem('reg-system', 'Registration System', registry, storage);
            await system.waitForReady();
        });

        test('should register new object successfully', async () => {
            const obj = new MockMementoObject('reg-test-1');

            const result = await system.registerObject(obj);

            assert.strictEqual(result.success, true);
            assert.strictEqual(system.isMementoRegistered('reg-test-1'), true);
            assert.strictEqual(registry.isRegistered('reg-test-1'), true);
        });

        test('should prevent duplicate registration', async () => {
            const obj = new MockMementoObject('duplicate-test');
            await system.registerObject(obj);

            try {
                await system.registerObject(obj);
                assert.fail('Should have thrown an error');
            } catch (error) {
                assert.ok(error instanceof Error);
                assert.ok(error.message.includes('already registered'));
            }
        });

        test('should auto-save when configured', async () => {
            system = new MementoSystem('autosave-system', 'AutoSave System', registry, storage, { autoSave: true });
            await system.waitForReady();

            const obj = new MockMementoObject('autosave-test');

            await system.registerObject(obj);

            assert.strictEqual(system.isMementoSaved('autosave-test'), true);
            assert.ok(storage.hasMemento('autosave-test'));
        });

        test('should handle auto-registration of references', async () => {
            const relatedObj = new MockMementoObject('auto-ref-related');
            const mainObj = new MockMementoObjectWithReferences('auto-ref-main', 'main', relatedObj);

            const result = await system.registerObject(mainObj, { autoRegister: true });

            assert.strictEqual(result.success, true);
            assert.ok(result.autoRegisteredIds.includes('auto-ref-related'));
            assert.strictEqual(system.isMementoRegistered('auto-ref-related'), true);
        });

        test('should wait for system to be ready before registering', async () => {
            storage.setLoadDelay(50); // Delay initialization
            system = new MementoSystem('delay-system', 'Delay System', registry, storage);

            const obj = new MockMementoObject('delay-test');
            const registerPromise = system.registerObject(obj);

            // System should still be initializing
            assert.strictEqual(system.getState(), MementoSystemState.Initializing);

            await registerPromise;

            assert.strictEqual(system.getState(), MementoSystemState.Ready);
            assert.strictEqual(system.isMementoRegistered('delay-test'), true);
        });
    });

    suite('object updates', () => {
        setup(async () => {
            system = new MementoSystem('update-system', 'Update System', registry, storage);
            await system.waitForReady();
        });

        test('should update existing object successfully', async () => {
            const obj = new MockMementoObject('update-test', 'original');
            await system.registerObject(obj);

            // Modify object
            obj.name = 'updated';

            const result = await system.updateObject(obj);

            assert.strictEqual(result.success, true);
        });

        test('should prevent updating unregistered object', async () => {
            const obj = new MockMementoObject('unregistered-update');

            try {
                await system.updateObject(obj);
                assert.fail('Should have thrown an error');
            } catch (error) {
                assert.ok(error instanceof Error);
                assert.ok(error.message.includes('Cannot update unregistered object'));
            }
        });

        test('should auto-save updated object when configured', async () => {
            system = new MementoSystem('update-autosave-system', 'Update AutoSave System', registry, storage, { autoSave: true });
            await system.waitForReady();

            const obj = new MockMementoObject('update-autosave-test');
            await system.registerObject(obj);
            
            obj.name = 'updated';
            await system.updateObject(obj);

            assert.strictEqual(system.isMementoSaved('update-autosave-test'), true);
        });

        test('should handle new references during update', async () => {
            const mainObj = new MockMementoObjectWithReferences('update-refs-main');
            await system.registerObject(mainObj);

            const newRef = new MockMementoObject('update-new-ref');
            mainObj.relatedObject = newRef;

            const result = await system.updateObject(mainObj, { autoRegister: true });

            assert.strictEqual(result.success, true);
            assert.ok(result.autoRegisteredIds.includes('update-new-ref'));
        });
    });

    suite('saving operations', () => {
        setup(async () => {
            system = new MementoSystem('save-system', 'Save System', registry, storage);
            await system.waitForReady();
        });

        test('should save individual memento', async () => {
            const obj = new MockMementoObject('save-individual');
            await system.registerObject(obj);

            await system.saveMemento('save-individual');

            assert.strictEqual(system.isMementoSaved('save-individual'), true);
            assert.ok(storage.hasMemento('save-individual'));
        });

        test('should handle save errors', async () => {
            const obj = new MockMementoObject('save-error');
            await system.registerObject(obj);

            storage.setThrowOnSave(true);

            try {
                await system.saveMemento('save-error');
                assert.fail('Should have thrown an error');
            } catch (error) {
                assert.ok(error instanceof Error);
            }
        });

        test('should save all registered mementos', async () => {
            const obj1 = new MockMementoObject('save-all-1');
            const obj2 = new MockMementoObject('save-all-2');
            
            await system.registerObject(obj1);
            await system.registerObject(obj2);

            await system.saveAllMementos();

            assert.strictEqual(system.isMementoSaved('save-all-1'), true);
            assert.strictEqual(system.isMementoSaved('save-all-2'), true);
            assert.ok(storage.hasMemento('save-all-1'));
            assert.ok(storage.hasMemento('save-all-2'));
        });

        test('should handle empty registry when saving all', async () => {
            await system.saveAllMementos(); // Should not throw
            assert.strictEqual(storage.getStorageSize(), 0);
        });

        test('should throw when saving unregistered object', async () => {
            try {
                await system.saveMemento('unregistered-save');
                assert.fail('Should have thrown an error');
            } catch (error) {
                assert.ok(error instanceof Error);
                assert.ok(error.message.includes('is not registered'));
            }
        });
    });

    suite('query operations', () => {
        setup(async () => {
            system = new MementoSystem('query-system', 'Query System', registry, storage);
            await system.waitForReady();
        });

        test('should return correct registered memento IDs', async () => {
            const obj1 = new MockMementoObject('query-reg-1');
            const obj2 = new MockMementoObject('query-reg-2');

            await system.registerObject(obj1);
            await system.registerObject(obj2);

            const registeredIds = system.getRegisteredMementoIds();
            
            assert.strictEqual(registeredIds.length, 2);
            assert.ok(registeredIds.includes('query-reg-1'));
            assert.ok(registeredIds.includes('query-reg-2'));
        });

        test('should return correct saved memento IDs', async () => {
            const obj1 = new MockMementoObject('query-saved-1');
            const obj2 = new MockMementoObject('query-saved-2');

            await system.registerObject(obj1);
            await system.registerObject(obj2);
            await system.saveMemento('query-saved-1');

            const savedIds = system.getSavedMementoIds();
            
            assert.strictEqual(savedIds.length, 1);
            assert.ok(savedIds.includes('query-saved-1'));
            assert.ok(!savedIds.includes('query-saved-2'));
        });

        test('should correctly report registration status', async () => {
            const obj = new MockMementoObject('status-test');
            
            assert.strictEqual(system.isMementoRegistered('status-test'), false);
            
            await system.registerObject(obj);
            
            assert.strictEqual(system.isMementoRegistered('status-test'), true);
        });

        test('should correctly report save status', async () => {
            const obj = new MockMementoObject('save-status-test');
            await system.registerObject(obj);

            assert.strictEqual(system.isMementoSaved('save-status-test'), false);
            
            await system.saveMemento('save-status-test');
            
            assert.strictEqual(system.isMementoSaved('save-status-test'), true);
        });
    });

    suite('loading operations', () => {
        setup(async () => {
            system = new MementoSystem('load-system', 'Load System', registry, storage);
            await system.waitForReady();
        });

        test('should load existing memento from storage', async () => {
            const testMemento = {
                id: 'load-test',
                type: 'TestType',
                primitives: { name: 'test' },
                references: {},
                collections: {},
                timestamp: Date.now()
            };

            await storage.saveMemento(testMemento);

            const loadedMemento = await system.loadMemento('load-test');

            assert.ok(loadedMemento);
            assert.strictEqual(loadedMemento.id, 'load-test');
            assert.strictEqual(loadedMemento.primitives.name, 'test');
        });

        test('should return undefined for non-existent memento', async () => {
            const loadedMemento = await system.loadMemento('non-existent');
            assert.strictEqual(loadedMemento, undefined);
        });

        test('should wait for ready state before loading', async () => {
            storage.setLoadDelay(50);
            system = new MementoSystem('load-delay-system', 'Load Delay System', registry, storage);

            const loadPromise = system.loadMemento('test-load');

            // Should wait for initialization
            const result = await loadPromise;
            assert.strictEqual(system.getState(), MementoSystemState.Ready);
        });
    });

    suite('system management', () => {
        setup(async () => {
            system = new MementoSystem('mgmt-system', 'Management System', registry, storage);
            await system.waitForReady();
        });

        test('should clear all data', async () => {
            const obj1 = new MockMementoObject('clear-1');
            const obj2 = new MockMementoObject('clear-2');

            await system.registerObject(obj1);
            await system.registerObject(obj2);
            await system.saveAllMementos();

            assert.strictEqual(system.getRegisteredMementoIds().length, 2);
            assert.strictEqual(storage.getStorageSize(), 2);

            await system.clearAll();

            assert.strictEqual(system.getRegisteredMementoIds().length, 0);
            assert.strictEqual(system.getSavedMementoIds().length, 0);
            assert.strictEqual(storage.getStorageSize(), 0);
        });

        test('should maintain system identity', async () => {
            assert.strictEqual(system.getId(), 'mgmt-system');
            assert.strictEqual(system.getDescription(), 'Management System');
        });

        test('should wait for ready state correctly', async () => {
            const readySystem = system;
            await readySystem.waitForReady(); // Should resolve immediately
            assert.strictEqual(readySystem.getState(), MementoSystemState.Ready);
        });
    });
});
