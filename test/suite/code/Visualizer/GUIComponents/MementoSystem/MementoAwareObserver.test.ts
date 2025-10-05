
import * as assert from 'assert';
import * as sinon from 'sinon';
import { MementoSystem } from '../../../../../../src/code/Visualizer/GUIComponents/MementoSystem/MementoSystem.js';
import { InMemoryMementoRegistry } from '../../../../../../src/code/Visualizer/GUIComponents/MementoSystem/Memento/InMemoryMementoRegistry.js';
import { createMemento } from '../../../../../../src/code/Visualizer/GUIComponents/MementoSystem/Memento/memento.js';
import { MementoAwareObserver, IMementoAwareListener } from '../../../../../../src/code/Visualizer/GUIComponents/MementoSystem/MementoAwareObserver.js';
import { MockMementoStorage } from '../../../../../code/Visualizer/GUIComponents/MementoSystem/MockMementoStorage.js';

// Test implementation of listener data
class TestListenerData {
  constructor(
    public message: string,
    public value: number,
    public timestamp: Date = new Date()
  ) {}
}

// Test implementation of IMementoAwareListener
class TestListener implements IMementoAwareListener<TestListenerData> {
  // These properties should not be persisted - they are runtime state
  private _notificationCount = 0;
  private _lastData?: TestListenerData;
  private _allNotifications: TestListenerData[] = [];

  constructor(
    public id: string,
    public name: string = 'test-listener',
    public isActive: boolean = true
  ) {}

  get notificationCount() { return this._notificationCount; }
  get lastData() { return this._lastData; }
  get allNotifications() { return this._allNotifications; }

  getId(): string {
    return this.id;
  }

  getObjectTypeName(): string {
    return this.constructor.name;
  }

  // Reset runtime state when restored from memento
  restoreFromMemento(): void {
    this._notificationCount = 0;
    this._lastData = undefined;
    this._allNotifications = [];
  }

  onNotify(data: TestListenerData): void {
    this._notificationCount++;
    this._lastData = data;
    this._allNotifications.push(data);
  }

  reset(): void {
    this._notificationCount = 0;
    this._lastData = undefined;
    this._allNotifications = [];
  }
}

suite('MementoAwareObserver Tests', () => {
  let registry: InMemoryMementoRegistry;

  setup(() => {
    registry = new InMemoryMementoRegistry();
  });

  teardown(() => {
    sinon.restore();
  });

  suite('Basic Functionality', () => {
    test('should create observer with correct id', () => {
      const observer = new MementoAwareObserver<TestListenerData>('obs-1');

      assert.strictEqual(observer.getId(), 'obs-1');
      assert.ok(Array.isArray(observer.listeners));
      assert.strictEqual(observer.listeners.length, 0);
    });

    test('should subscribe a single listener', () => {
      const observer = new MementoAwareObserver<TestListenerData>('obs-1');
      const listener = new TestListener('listener-1', 'First Listener');

      observer.subscribe(listener);

      assert.strictEqual(observer.listeners.length, 1);
      assert.strictEqual(observer.listeners[0].getId(), 'listener-1');
    });

    test('should subscribe multiple listeners', () => {
      const observer = new MementoAwareObserver<TestListenerData>('obs-1');
      const listener1 = new TestListener('listener-1');
      const listener2 = new TestListener('listener-2');
      const listener3 = new TestListener('listener-3');

      observer.subscribe(listener1);
      observer.subscribe(listener2);
      observer.subscribe(listener3);

      assert.strictEqual(observer.listeners.length, 3);
    });

    test('should not add duplicate listeners', () => {
      const observer = new MementoAwareObserver<TestListenerData>('obs-1');
      const listener = new TestListener('listener-1');

      observer.subscribe(listener);
      observer.subscribe(listener); // Try to add again
      observer.subscribe(listener); // And again

      assert.strictEqual(observer.listeners.length, 1, 'Should only have one listener');
    });

    test('should unsubscribe a listener', () => {
      const observer = new MementoAwareObserver<TestListenerData>('obs-1');
      const listener1 = new TestListener('listener-1');
      const listener2 = new TestListener('listener-2');

      observer.subscribe(listener1);
      observer.subscribe(listener2);
      assert.strictEqual(observer.listeners.length, 2);

      observer.unsubscribe(listener1);

      assert.strictEqual(observer.listeners.length, 1);
      assert.strictEqual(observer.listeners[0].getId(), 'listener-2');
    });

    test('should handle unsubscribe of non-existent listener', () => {
      const observer = new MementoAwareObserver<TestListenerData>('obs-1');
      const listener1 = new TestListener('listener-1');
      const listener2 = new TestListener('listener-2');

      observer.subscribe(listener1);
      observer.unsubscribe(listener2); // Not subscribed

      assert.strictEqual(observer.listeners.length, 1);
      assert.strictEqual(observer.listeners[0].getId(), 'listener-1');
    });

    test('should notify all listeners', () => {
      const observer = new MementoAwareObserver<TestListenerData>('obs-1');
      const listener1 = new TestListener('listener-1');
      const listener2 = new TestListener('listener-2');
      const listener3 = new TestListener('listener-3');

      observer.subscribe(listener1);
      observer.subscribe(listener2);
      observer.subscribe(listener3);

      const data = new TestListenerData('Hello', 42);
      observer.notify(data);

      assert.strictEqual(listener1.notificationCount, 1);
      assert.strictEqual(listener2.notificationCount, 1);
      assert.strictEqual(listener3.notificationCount, 1);
      assert.strictEqual(listener1.lastData, data);
      assert.strictEqual(listener2.lastData, data);
      assert.strictEqual(listener3.lastData, data);
    });

    test('should notify with empty listener list', () => {
      const observer = new MementoAwareObserver<TestListenerData>('obs-1');
      const data = new TestListenerData('Test', 0);

      // Should not throw
      assert.doesNotThrow(() => {
        observer.notify(data);
      });
    });

    test('should pass correct data to listeners', () => {
      const observer = new MementoAwareObserver<TestListenerData>('obs-1');
      const listener = new TestListener('listener-1');
      observer.subscribe(listener);

      const data1 = new TestListenerData('First', 1);
      const data2 = new TestListenerData('Second', 2);

      observer.notify(data1);
      observer.notify(data2);

      assert.strictEqual(listener.notificationCount, 2);
      assert.strictEqual(listener.allNotifications.length, 2);
      assert.strictEqual((listener.allNotifications[0] as TestListenerData).message, 'First');
      assert.strictEqual((listener.allNotifications[1] as TestListenerData).message, 'Second');
    });
  });

  suite('Memento Creation', () => {
    test('should create memento with registered listeners', () => {
      const observer = new MementoAwareObserver<TestListenerData>('obs-1');
      const listener1 = new TestListener('listener-1');
      const listener2 = new TestListener('listener-2');

      registry.register(listener1);
      registry.register(listener2);
      observer.subscribe(listener1);
      observer.subscribe(listener2);

      const result = createMemento(observer, registry);

      assert.strictEqual(result.success, true);
      assert.ok(result.memento);

      // Check that listeners are stored as references
      const collection = result.memento!.collections.listeners;
      assert.ok(collection);
      assert.strictEqual(collection.type, 'array');
      assert.strictEqual(collection.items.length, 2);
      assert.strictEqual(collection.items.filter(item => item.kind === 'reference').length, 2);

      const refIds = collection.items.filter(item => item.kind === 'reference').map(item => item.id);
      assert.ok(refIds.includes('listener-1'));
      assert.ok(refIds.includes('listener-2'));
    });

    test('should auto-register unregistered listeners', () => {
      const observer = new MementoAwareObserver<TestListenerData>('obs-1');
      const listener1 = new TestListener('listener-1', 'Auto Reg 1');
      const listener2 = new TestListener('listener-2', 'Auto Reg 2');

      observer.subscribe(listener1);
      observer.subscribe(listener2);

      const result = createMemento(observer, registry, { autoRegister: true });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.autoRegisteredIds.length, 2);
      assert.ok(result.autoRegisteredIds.includes('listener-1'));
      assert.ok(result.autoRegisteredIds.includes('listener-2'));
      assert.ok(registry.isRegistered('listener-1'));
      assert.ok(registry.isRegistered('listener-2'));
    });

    test('should handle empty listener list', () => {
      const observer = new MementoAwareObserver<TestListenerData>('empty-obs');

      const result = createMemento(observer, registry);

      assert.strictEqual(result.success, true);
      assert.ok(result.memento);

      const collection = result.memento!.collections.listeners;
      assert.ok(collection);
      assert.strictEqual(collection.items.length, 0);
    });

    test('should skip unregistered listeners when auto-register disabled', () => {
      const observer = new MementoAwareObserver<TestListenerData>('obs-1');
      const registeredListener = new TestListener('registered');
      const unregisteredListener = new TestListener('unregistered');

      registry.register(registeredListener);
      observer.subscribe(registeredListener);
      observer.subscribe(unregisteredListener);

      const result = createMemento(observer, registry, { autoRegister: false });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.autoRegisteredIds.length, 0);

      const collection = result.memento!.collections.listeners;
      assert.strictEqual(collection.items.filter(item => item.kind === 'reference').length, 1);
      assert.strictEqual(collection.items.find(item => item.id === 'registered')?.id, 'registered');
    });
  });

  suite('MementoSystem Integration', () => {
    let system: MementoSystem;
    let storage: MockMementoStorage;

    setup(async () => {
      storage = new MockMementoStorage();
      system = new MementoSystem(
        'observer-system',
        'Observer System',
        registry,
        storage,
        { autoSave: true }
      );
      await system.waitForReady();

      // Register factories for restoration
      system.registerFactory('MementoAwareObserver', (memento) => {
        return new MementoAwareObserver<TestListenerData>(memento.primitives.id as string);
      });

      system.registerFactory('TestListener', (memento) => {
        return new TestListener(
          memento.primitives.id as string,
          memento.primitives.name as string,
          memento.primitives.isActive as boolean
        );
      });
    });

    test('should register observer with listeners in system', async () => {
      const observer = new MementoAwareObserver<TestListenerData>('obs-1');
      const listener1 = new TestListener('listener-1', 'Listener One');
      const listener2 = new TestListener('listener-2', 'Listener Two');

      observer.subscribe(listener1);
      observer.subscribe(listener2);

      const result = await system.registerObject(observer, { autoRegister: true });

      assert.strictEqual(result.success, true);
      assert.ok(result.autoRegisteredIds.includes('listener-1'));
      assert.ok(result.autoRegisteredIds.includes('listener-2'));
      assert.ok(system.isMementoSaved('obs-1'));
      assert.ok(system.isMementoSaved('listener-1'));
      assert.ok(system.isMementoSaved('listener-2'));
    });

    test('should load and restore observer with listeners', async () => {
      // Create and save
      const observer = new MementoAwareObserver<TestListenerData>('obs-1');
      const listener1 = new TestListener('listener-1', 'Listener One');
      const listener2 = new TestListener('listener-2', 'Listener Two');

      observer.subscribe(listener1);
      observer.subscribe(listener2);

      await system.registerObject(observer, { autoRegister: true });

      // Clear registry to simulate fresh load
      registry.clear();

      // Load everything back
      await system.loadAll();

      // Verify restoration
      const restoredObserver = registry.get<MementoAwareObserver<TestListenerData>>('obs-1');
      assert.ok(restoredObserver);
      assert.strictEqual(restoredObserver.listeners.length, 2);

      const restoredListener1 = registry.get<TestListener>('listener-1');
      const restoredListener2 = registry.get<TestListener>('listener-2');
      assert.ok(restoredListener1);
      assert.ok(restoredListener2);
      assert.strictEqual(restoredListener1.name, 'Listener One');
      assert.strictEqual(restoredListener2.name, 'Listener Two');

      // Verify listeners are correctly wired
      assert.strictEqual(restoredObserver.listeners[0], restoredListener1);
      assert.strictEqual(restoredObserver.listeners[1], restoredListener2);
    });

    test('should maintain functionality after restoration', async () => {
      // Create and save
      const observer = new MementoAwareObserver<TestListenerData>('obs-1');
      const listener = new TestListener('listener-1', 'Test Listener');

      observer.subscribe(listener);
      await system.registerObject(observer, { autoRegister: true });

      // Load back
      registry.clear();
      await system.loadAll();

      const restoredObserver = registry.get<MementoAwareObserver<TestListenerData>>('obs-1');
      const restoredListener = registry.get<TestListener>('listener-1');

      assert.ok(restoredObserver);
      assert.ok(restoredListener);

      // Test notification after restoration
      const data = new TestListenerData('After Restore', 100);
      restoredObserver.notify(data);

      assert.strictEqual(restoredListener.notificationCount, 1);
      assert.strictEqual((restoredListener.lastData as TestListenerData).message, 'After Restore');
      assert.strictEqual((restoredListener.lastData as TestListenerData).value, 100);
    });

    test('should handle observer with no listeners', async () => {
      const observer = new MementoAwareObserver<TestListenerData>('empty-obs');

      await system.registerObject(observer);

      registry.clear();
      await system.loadAll();

      const restored = registry.get<MementoAwareObserver<TestListenerData>>('empty-obs');
      assert.ok(restored);
      assert.strictEqual(restored.listeners.length, 0);
    });

    test('should update observer when listeners change', async () => {
      const observer = new MementoAwareObserver<TestListenerData>('obs-1');
      const listener1 = new TestListener('listener-1');

      observer.subscribe(listener1);
      await system.registerObject(observer, { autoRegister: true });

      // Add another listener
      const listener2 = new TestListener('listener-2');
      observer.subscribe(listener2);

      await system.updateObject(observer, { autoRegister: true });

      assert.ok(system.isMementoSaved('listener-2'));

      // Verify after reload
      registry.clear();
      await system.loadAll();

      const restored = registry.get<MementoAwareObserver<TestListenerData>>('obs-1');
      assert.ok(restored);
      assert.strictEqual(restored.listeners.length, 2);
    });

    test('should handle unsubscribe and update', async () => {
      const observer = new MementoAwareObserver<TestListenerData>('obs-1');
      const listener1 = new TestListener('listener-1');
      const listener2 = new TestListener('listener-2');

      observer.subscribe(listener1);
      observer.subscribe(listener2);
      await system.registerObject(observer, { autoRegister: true });

      // Remove a listener
      observer.unsubscribe(listener1);
      await system.updateObject(observer);

      // Reload and verify
      registry.clear();
      await system.loadAll();

      const restored = registry.get<MementoAwareObserver<TestListenerData>>('obs-1');
      assert.ok(restored);
      assert.strictEqual(restored.listeners.length, 1);
      assert.strictEqual(restored.listeners[0].getId(), 'listener-2');
    });
  });

  suite('Complex Scenarios', () => {
    test('should handle multiple observers sharing listeners', async () => {
      const storage = new MockMementoStorage();
      const system = new MementoSystem(
        'multi-obs-system',
        'Multi Observer System',
        registry,
        storage,
        { autoSave: true }
      );
      await system.waitForReady();

      system.registerFactory('MementoAwareObserver', (memento) => {
        return new MementoAwareObserver<TestListenerData>(memento.primitives.id as string);
      });
      system.registerFactory('TestListener', (memento) => {
        return new TestListener(
          memento.primitives.id as string,
          memento.primitives.name as string
        );
      });

      const sharedListener = new TestListener('shared-listener', 'Shared');
      const observer1 = new MementoAwareObserver<TestListenerData>('obs-1');
      const observer2 = new MementoAwareObserver<TestListenerData>('obs-2');

      observer1.subscribe(sharedListener);
      observer2.subscribe(sharedListener);

      await system.registerObject(observer1, { autoRegister: true });
      await system.registerObject(observer2, { autoRegister: true });

      // Shared listener should only be registered once
      const registeredIds = system.getRegisteredMementoIds();
      const sharedListenerCount = registeredIds.filter(id => id === 'shared-listener').length;
      assert.strictEqual(sharedListenerCount, 1);

      // Load and verify
      registry.clear();
      await system.loadAll();

      const restored1 = registry.get<MementoAwareObserver<TestListenerData>>('obs-1');
      const restored2 = registry.get<MementoAwareObserver<TestListenerData>>('obs-2');
      const restoredShared = registry.get<TestListener>('shared-listener');

      assert.ok(restored1);
      assert.ok(restored2);
      assert.ok(restoredShared);

      // Verify both observers reference the same listener instance
      assert.strictEqual(restored1.listeners[0], restoredShared);
      assert.strictEqual(restored2.listeners[0], restoredShared);

      // Notify from both observers
      const data = new TestListenerData('Shared notification', 99);
      restored1.notify(data);
      assert.strictEqual(restoredShared.notificationCount, 1);

      restored2.notify(data);
      assert.strictEqual(restoredShared.notificationCount, 2);
    });

    test('should handle observer with mixed listener states', async () => {
      const storage = new MockMementoStorage();
      const system = new MementoSystem('mixed-system', 'Mixed System', registry, storage);
      await system.waitForReady();

      system.registerFactory('MementoAwareObserver', (memento) => {
        return new MementoAwareObserver<TestListenerData>(memento.primitives.id as string);
      });
      system.registerFactory('TestListener', (memento) => {
        return new TestListener(memento.primitives.id as string, memento.primitives.name as string);
      });

      const observer = new MementoAwareObserver<TestListenerData>('obs-1');
      const listener1 = new TestListener('listener-1', 'Already Registered');
      const listener2 = new TestListener('listener-2', 'To Be Auto-Registered');

      // Pre-register one listener
      registry.register(listener1);

      observer.subscribe(listener1);
      observer.subscribe(listener2);

      const result = await system.registerObject(observer, { autoRegister: true });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.autoRegisteredIds.length, 1);
      assert.ok(result.autoRegisteredIds.includes('listener-2'));
      assert.ok(!result.autoRegisteredIds.includes('listener-1'));
    });

    test('should handle notification during and after memento operations', async () => {
      const storage = new MockMementoStorage();
      const system = new MementoSystem('notif-system', 'Notification System', registry, storage, { autoSave: true });
      await system.waitForReady();

      system.registerFactory('MementoAwareObserver', (memento) => {
        return new MementoAwareObserver<TestListenerData>(memento.primitives.id as string);
      });
      system.registerFactory('TestListener', (memento) => {
        return new TestListener(memento.primitives.id as string, memento.primitives.name as string);
      });

      const observer = new MementoAwareObserver<TestListenerData>('obs-1');
      const listener = new TestListener('listener-1');

      observer.subscribe(listener);

      // Notify before registration
      const data1 = new TestListenerData('Before registration', 1);
      observer.notify(data1);
      assert.strictEqual(listener.notificationCount, 1);

      // Register
      await system.registerObject(observer, { autoRegister: true });

      // Notify after registration
      const data2 = new TestListenerData('After registration', 2);
      observer.notify(data2);
      assert.strictEqual(listener.notificationCount, 2);

      // Update
      await system.updateObject(observer);

      // Notify after update
      const data3 = new TestListenerData('After update', 3);
      observer.notify(data3);
      assert.strictEqual(listener.notificationCount, 3);

      // Load and notify
      registry.clear();
      await system.loadAll();

      const restoredObserver = registry.get<MementoAwareObserver<TestListenerData>>('obs-1');
      const restoredListener = registry.get<TestListener>('listener-1');

      const data4 = new TestListenerData('After load', 4);
      restoredObserver!.notify(data4);
      assert.strictEqual(restoredListener!.notificationCount, 1); // Fresh instance
    });

    test('should maintain listener order after restoration', async () => {
      const storage = new MockMementoStorage();
      const system = new MementoSystem('order-system', 'Order System', registry, storage, { autoSave: true });
      await system.waitForReady();

      system.registerFactory('MementoAwareObserver', (memento) => {
        return new MementoAwareObserver<TestListenerData>(memento.primitives.id as string);
      });
      system.registerFactory('TestListener', (memento) => {
        return new TestListener(memento.primitives.id as string, memento.primitives.name as string);
      });

      const observer = new MementoAwareObserver<TestListenerData>('obs-1');
      const listener1 = new TestListener('listener-1', 'First');
      const listener2 = new TestListener('listener-2', 'Second');
      const listener3 = new TestListener('listener-3', 'Third');

      observer.subscribe(listener1);
      observer.subscribe(listener2);
      observer.subscribe(listener3);

      await system.registerObject(observer, { autoRegister: true });

      // Load back
      registry.clear();
      await system.loadAll();

      const restored = registry.get<MementoAwareObserver<TestListenerData>>('obs-1');
      assert.ok(restored);
      assert.strictEqual(restored.listeners.length, 3);

      // Verify order is maintained
      assert.strictEqual(restored.listeners[0].getId(), 'listener-1');
      assert.strictEqual(restored.listeners[1].getId(), 'listener-2');
      assert.strictEqual(restored.listeners[2].getId(), 'listener-3');
    });
  });

  suite('Error Handling', () => {
    test('should handle listener without proper memento implementation', () => {
      const observer = new MementoAwareObserver<TestListenerData>('obs-1');
      const listener1 = new TestListener('listener-1');
      const listener2 = new TestListener('listener-2');

      // Subscribe both listeners
      observer.subscribe(listener1);
      observer.subscribe(listener2);

      // Try to create memento without auto-register (listener2 is not registered)
      const result = createMemento(observer, registry, { autoRegister: false });

      // The memento creation should succeed
      assert.strictEqual(result.success, true);

      // Only registered listeners should be included
      const listenersCollection = result.memento?.collections.listeners;
      assert.ok(listenersCollection);
      assert.strictEqual(listenersCollection.items.length, 0, 'Unregistered listeners should be skipped when autoRegister is false');
    });

    test('should handle storage errors during system operations', async () => {
      const storage = new MockMementoStorage();
      const system = new MementoSystem('error-system', 'Error System', registry, storage, { autoSave: true });
      await system.waitForReady();

      const observer = new MementoAwareObserver<TestListenerData>('obs-1');
      const listener = new TestListener('listener-1');
      observer.subscribe(listener);

      storage.setThrowOnSave(true);

      try {
        await system.registerObject(observer, { autoRegister: true });
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.ok(error instanceof Error);
      }
    });
  });
});