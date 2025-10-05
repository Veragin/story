import {
  WithMemento,
  MementoRegistry,
  MementoRecord,
  MementoOptions,
  MementoResult
} from './Memento/mementoTypes';
import { createMemento, restoreObjectFromMemento } from './Memento/memento';
import { MementoStorage } from './MementoStorage';
import { MementoSerializer } from './MementoSerializer';
import { MementoSystemOptions } from './MementoSystemOptions';
import { MementoSystemState } from './MementoSystemState';

/**
 * Main memento system that coordinates registration, persistence, and loading
 */
export class MementoSystem {
  private state: MementoSystemState = MementoSystemState.Uninitialized;
  private savedMementoIds = new Set<string>(); // Track what's been saved
  private serializer = new MementoSerializer();

  constructor(
    private readonly systemId: string,
    private readonly description: string,
    private readonly registry: MementoRegistry,
    private readonly storage: MementoStorage,
    private readonly options: MementoSystemOptions = {}
  ) {
    // Auto-initialize
    this.initialize();
  }


  /**
   * Get the system ID
   */
  getId(): string {
    return this.systemId;
  }

  /**
   * Get the system description
   */
  getDescription(): string {
    return this.description;
  }

  /**
   * Get the current state of the system
   */
  getState(): MementoSystemState {
    return this.state;
  }

  /**
   * Initialize the memento system by loading all saved memento IDs
   */
  private async initialize(): Promise<void> {
    this.state = MementoSystemState.Initializing;

    try {
      // Load all memento IDs from storage
      const savedIds = await this.storage.loadMementoIds();

      // Add them to our saved set (these are registered, not loaded, but saved)
      for (const id of savedIds) {
        this.savedMementoIds.add(id);
      }

      this.state = MementoSystemState.Ready;
    } catch (error) {
      this.state = MementoSystemState.Error;
      throw new Error(`Failed to initialize memento system '${this.systemId}': ${error}`);
    }
  }

  /**
   * Wait for the system to be ready
   */
  async waitForReady(): Promise<void> {
    while (this.state === MementoSystemState.Initializing) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    if (this.state === MementoSystemState.Error) {
      throw new Error(`Memento system '${this.systemId}' is in error state`);
    }
  }

  /**
   * Register a new memento object and all its referenced objects
   */
  async registerObject<T extends WithMemento>(
    obj: T,
    mementoOptions?: Partial<MementoOptions>
  ): Promise<MementoResult> {
    await this.waitForReady();

    // Check if object is already registered
    const objectId = obj.getId();
    if (this.registry.isRegistered(objectId)) {
      throw new Error(`Object with ID '${objectId}' is already registered`);
    }

    // Merge options with defaults
    const options: Partial<MementoOptions> = {
      autoRegister: true, // Always auto-register for cascading
      ...this.options.defaultMementoOptions,
      ...mementoOptions
    };

    // Create memento using existing system - this will handle cascading registration
    const result = createMemento(obj, this.registry, options);

    if (result.success){
      this.registry.register(obj);
    }

    if (result.success && this.options.autoSave) {
      // Auto-save if configured
      await this.saveMemento(obj.getId());
      for (const newId of result.autoRegisteredIds) {
        await this.saveMemento(newId);
      }
    }

    return result;
  }

  /**
   * Update an existing memento object
   */
  async updateObject<T extends WithMemento>(
    obj: T,
    mementoOptions?: Partial<MementoOptions>
  ): Promise<MementoResult> {
    await this.waitForReady();

    const objectId = obj.getId();

    // Check if object is registered
    if (!this.registry.isRegistered(objectId)) {
      throw new Error(`Cannot update unregistered object with ID: ${objectId}`);
    }

    // Create updated memento
    const options: Partial<MementoOptions> = {
      autoRegister: true, // Handle any new references
      ...this.options.defaultMementoOptions,
      ...mementoOptions
    };

    const result = createMemento(obj, this.registry, options);

    if (result.success && this.options.autoSave) {
      // Auto-save if configured, save all new registrations
      await this.saveMemento(objectId);
      for (const newId of result.autoRegisteredIds) {
        await this.saveMemento(newId);
      }
    }

    return result;
  }

  /**
   * Save a specific registered memento object
   */
  async saveMemento(objectId: string): Promise<void> {
    await this.waitForReady();

    // Get object from registry
    const obj = this.registry.get(objectId);
    if (!obj) {
      throw new Error(`Object with ID '${objectId}' is not registered`);
    }

    // Create memento
    const result = createMemento(obj, this.registry, this.options.defaultMementoOptions);
    if (!result.success || !result.memento) {
      throw new Error(`Failed to create memento for object '${objectId}': ${result.error}`);
    }

    // Save to storage
    await this.storage.saveMemento(result.memento);
    this.savedMementoIds.add(objectId);
  }

  /**
   * Save all registered memento objects
   */
  async saveAllMementos(): Promise<void> {
    await this.waitForReady();

    const registeredIds = this.registry.getRegisteredIds();
    if (registeredIds.length === 0) {
      return; // Nothing to save
    }

    const mementos: MementoRecord[] = [];
``
    // Create mementos for all registered objects
    for (const objectId of registeredIds) {
      const obj = this.registry.get(objectId);
      if (obj) {
        const result = createMemento(obj, this.registry, this.options.defaultMementoOptions);
        if (result.success && result.memento) {
          mementos.push(result.memento);
        }
      }
    }

    for (const memento of mementos) {
      await this.storage.saveMemento(memento);
      this.savedMementoIds.add(memento.id);
    }
  }

  /**
   * Check if a memento object is saved
   */
  isMementoSaved(objectId: string): boolean {
    return this.savedMementoIds.has(objectId);
  }

  /**
   * Check if a memento object is registered
   */
  isMementoRegistered(objectId: string): boolean {
    return this.registry.isRegistered(objectId);
  }

  /**
   * Get all saved memento IDs
   */
  getSavedMementoIds(): string[] {
    return Array.from(this.savedMementoIds);
  }

  /**
   * Get all registered memento IDs
   */
  getRegisteredMementoIds(): string[] {
    return this.registry.getRegisteredIds();
  }

  /**
   * Load and restore an object by ID
   */
  async loadObject<T extends WithMemento>(objectId: string): Promise<T | undefined> {
    await this.waitForReady();

    if (this.registry.isRegistered(objectId)) {
      return this.registry.get<T>(objectId);
    }

    const memento = await this.storage.loadMemento(objectId);
    if (!memento) return undefined;

    const obj = restoreObjectFromMemento(memento, this.registry);
    this.registry.register(obj);

    if (obj.restoreFromMemento) {
      obj.restoreFromMemento(memento, this.registry);
    }

    return obj as T;
  }

  /**
   * Load and restore all saved objects
   */
  async loadAll(): Promise<void> {
    await this.waitForReady();

    const ids = await this.storage.loadMementoIds();
    const mementoMap = new Map<string, MementoRecord>();

    for (const id of ids) {
      const m = await this.storage.loadMemento(id);
      if (m) mementoMap.set(id, m);
    }

    // Phase 1: Create and register all objects with primitives
    const objects = new Map<string, WithMemento>();
    for (const memento of mementoMap.values()) {
      var obj = restoreObjectFromMemento(memento, this.registry);
      
      // Set primitives
      for (const [key, value] of Object.entries(memento.primitives)) {
        (obj as any)[key] = value;
      }

      objects.set(memento.id, obj);
      this.registry.register(obj);
    }

    // Phase 2: Set collections and references
    for (const [id, obj] of objects) {
      const memento = mementoMap.get(id)!;

      // Set collections
      for (const [colKey, col] of Object.entries(memento.collections)) {
        if (col.type === 'array') {
          const arr: any[] = [];
          for (const item of col.items ?? []) {
            if (item.kind === 'primitive') {
              arr.push(item.value);
            } else if (item.kind === 'reference') {
              const ref = this.registry.get(item.id!);
              if (ref === undefined) throw new Error(`Missing reference ${item.id}`);
              arr.push(ref);
            } else if (item.kind === 'object') {
              const sub: Record<string, any> = {};
              for (const [pkey, pval] of Object.entries(item.primitives ?? {})) {
                sub[pkey] = pval;
              }
              arr.push(sub);
            }
          }
          (obj as any)[colKey] = arr;
        }
        // TODO: handle set/map if needed
      }

      // Set references
      for (const [refKey, refId] of Object.entries(memento.references)) {
        const ref = this.registry.get(refId);
        if (ref === undefined) throw new Error(`Missing reference ${refId}`);
        (obj as any)[refKey] = ref;
      }
    }

    // Phase 3: Call custom restore methods
    for (const obj of objects.values()) {
      if (obj.restoreFromMemento) {
        const memento = mementoMap.get(obj.getId())!;
        obj.restoreFromMemento(memento, this.registry);
      }
    }

    if (this.options.validateOnLoad) {
      // Optional: implement validation, e.g., check for unresolved references
    }
  }

  // Remove or comment out the old loadMemento as it's now loadObject/loadAll
  // async loadMemento(objectId: string): Promise<MementoRecord | undefined> { ... }

  /**
   * Clear all data (registry and storage)
   */
  async clearAll(): Promise<void> {
    await this.waitForReady();

    this.registry.clear();
    this.savedMementoIds.clear();
    await this.storage.clear();
  }
}