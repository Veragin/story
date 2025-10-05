import {
  WithMemento,
  MementoRegistry,
  MementoOptions,
  MementoResult,
  MementoContext,
  MementoRecord,
  PropertyType,
  PrimitiveValue,
  PropertyProcessResult,
  MementoCollection
} from './mementoTypes';
import { TypeGuards } from './TypeGuards';
import { MementoError } from './MementoError';
import { getEnumerableProperties, hasCircularReference } from './mementoUtils';
import { PrimitiveProcessor } from './processors/PrimitiveProcessor';
import { WithMementoProcessor } from './processors/WithMementoProcessor';
import { ArrayProcessor } from './processors/ArrayProcessor';
import { PlainObjectProcessor } from './processors/PlainObjectProcessor';

/**
 * DEFAULT OPTIONS
 */
const DEFAULT_MEMENTO_OPTIONS: MementoOptions = {
  autoRegister: false,
  maxDepth: 10,
  skipProperties: []
};

/**
 * Helper function to create all processors
 */
function initializeProcessors() {
  return {
    primitive: new PrimitiveProcessor(),
    withMemento: new WithMementoProcessor(),
    array: new ArrayProcessor(),
    plainObject: new PlainObjectProcessor()
  };
}

/**
 * MAIN MEMENTO CREATION API
 */
export function createMemento<T extends WithMemento>(
  obj: T,
  registry: MementoRegistry,
  options?: Partial<MementoOptions>
): MementoResult {
  // Validate input
  if (!obj) {
    return {
      success: false,
      error: 'Object cannot be null or undefined',
      skippedProperties: [],
      autoRegisteredIds: []
    };
  }

  if (!TypeGuards.isWithMemento(obj)) {
    return {
      success: false,
      error: 'Object must implement WithMemento interface',
      skippedProperties: [],
      autoRegisteredIds: []
    };
  }

  // Merge options with defaults
  const mergedOptions: MementoOptions = {
    ...DEFAULT_MEMENTO_OPTIONS,
    ...options
  };

  // Create context
  const context: MementoContext = {
    registry,
    options: mergedOptions,
    visitedObjects: new Set(),
    currentDepth: 0
  };

  try {
    return createMementoRecursive(obj, context);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      skippedProperties: [],
      autoRegisteredIds: []
    };
  }
}

function createMementoRecursive(
  obj: WithMemento,
  context: MementoContext
): MementoResult {

  if (hasCircularReference(obj, context.visitedObjects)) {
    throw new MementoError(
      'Circular reference detected',
      'createMementoRecursive'
    );
  }

  if (context.currentDepth >= context.options.maxDepth) {
    throw new MementoError(
      `Maximum depth ${context.options.maxDepth} exceeded`,
      'createMementoRecursive'
    );
  }

  const newVisited = new Set(context.visitedObjects);
  newVisited.add(obj);

  const updatedContext: MementoContext = {
    ...context,
    visitedObjects: newVisited,
    currentDepth: context.currentDepth + 1
  };

  const processors = initializeProcessors();

  // Get object properties
  const properties = getEnumerableProperties(obj);
  const primitives: Record<string, PrimitiveValue> = {};
  const references: Record<string, string> = {};
  const collections: Record<string, MementoCollection> = {};
  const skippedProperties: string[] = [];
  const autoRegisteredIds: string[] = [];

  // Process each property
  for (const prop of properties) {
    // Skip if in skip list
    if (context.options.skipProperties?.includes(prop.name)) {
      skippedProperties.push(prop.name);
      continue;
    }

    let result: PropertyProcessResult | null = null;
    let processed = false;

    // Try each processor in order
    for (const [processorName, processor] of Object.entries(processors)) {
      if (processor.canProcess(prop.value)) {
        try {
          result = processor.process(prop.name, prop.value, updatedContext);
          processed = true;
          break;
        } catch (error) {
          // If a processor fails, continue to next processor
          continue;
        }
      }
    }

    // If no processor could handle it, skip the property
    if (!processed) {
      skippedProperties.push(prop.name);
      continue;
    }

    // Process the result
    if (result && result.shouldInclude) {
      if (result.primitiveValue !== undefined) {
        primitives[prop.name] = result.primitiveValue;
      }
      if (result.referenceId !== undefined) {
        references[prop.name] = result.referenceId;
      }
      if (result.collection !== undefined) {
        collections[prop.name] = result.collection;
      }
      if (result.newlyRegistered && result.newlyRegistered.length > 0) {
        autoRegisteredIds.push(...result.newlyRegistered);
      }
    } else if (result && !result.shouldInclude) {
      // Property was processed but should not be included
      skippedProperties.push(prop.name);
      if (result.newlyRegistered && result.newlyRegistered.length > 0) {
        autoRegisteredIds.push(...result.newlyRegistered);
      }
    }
  }

  // If auto-registration is enabled, recursively process newly registered objects
  // to find and auto-register their nested WithMemento references
  if (context.options.autoRegister && autoRegisteredIds.length > 0) {
    const additionalAutoRegistered: string[] = [];

    for (const registeredId of autoRegisteredIds) {
      // Get the registered object from the registry
      const registeredObj = context.registry.get(registeredId);
      if (registeredObj && TypeGuards.isWithMemento(registeredObj)) {

        // Only process objects that haven't been visited to avoid circular references
        if (!context.visitedObjects.has(registeredObj)) {

          // Check depth limit before proceeding
          if (context.currentDepth < context.options.maxDepth) {
            try {
              const nestedResult = createMementoRecursive(registeredObj, updatedContext);
              if (nestedResult.success && nestedResult.autoRegisteredIds.length > 0) {
                // Add any newly discovered auto-registered objects
                for (const nestedId of nestedResult.autoRegisteredIds) {
                  if (!autoRegisteredIds.includes(nestedId) && !additionalAutoRegistered.includes(nestedId)) {
                    additionalAutoRegistered.push(nestedId);
                  }
                }
              }
            } catch (error) {
              // If recursive processing fails due to depth limits or circular references,
              // the entire operation should fail
              if (error instanceof MementoError) {
                throw error;
              }
              // For other errors, continue with other objects
              continue;
            }
          }
        }
      }
    }

    // Add any additional auto-registered objects to our list
    autoRegisteredIds.push(...additionalAutoRegistered);
  }

  // Create memento record
  const memento: MementoRecord = {
    id: obj.getId(),
    type: obj.getObjectTypeName(),
    primitives,
    references,
    collections,
    timestamp: Date.now()
  };

  return {
    success: true,
    memento,
    skippedProperties,
    autoRegisteredIds
  };
}

export function restoreObjectFromMemento(
  memento: MementoRecord,
  registry: MementoRegistry): WithMemento {

  const obj: WithMemento = createObjectInstance(memento.type);

  // Set primitives
  for (const [key, value] of Object.entries(memento.primitives)) {
    (obj as any)[key] = value;
  }

  // Set collections
  for (const [colKey, col] of Object.entries(memento.collections)) {
    if (col.type === 'array') {
      const arr: any[] = [];
      for (const item of col.items ?? []) {
        if (item.kind === 'primitive') {
          arr.push(item.value);
        } else if (item.kind === 'reference') {
          const ref = registry.get(item.id!);
          if (ref === undefined) throw new Error(`Missing reference ${item.id}`);
          arr.push(ref);
        } else if (item.kind === 'object') {
          // Check if this is a nested listener class instance
          if (isNestedListenerClass(item.type)) {
            const listenerObj = restoreNestedListener(item, obj, registry);
            arr.push(listenerObj);
          } else {
            const sub: Record<string, any> = {};
            for (const [pkey, pval] of Object.entries(item.primitives ?? {})) {
              sub[pkey] = pval;
            }
            arr.push(sub);
          }
        }
      }
      (obj as any)[colKey] = arr;
    }
    // TODO: handle set/map if needed
  }

  // Set references
  for (const [refKey, refId] of Object.entries(memento.references)) {
    const ref = registry.get(refId);
    if (ref === undefined) throw new Error(`Missing reference ${refId}`);
    (obj as any)[refKey] = ref;
  }

  obj.restoreFromMemento?.(memento, registry);

  return obj;
}

function createObjectInstance(objType: string): WithMemento {
  const constructor = (globalThis as any)[objType];
  if (!constructor) {
    throw new MementoError(
      `Cannot find constructor for type: ${objType}`,
      'createObjectInstance'
    );
  }
  return Object.create(constructor.prototype);
}

/**
 * Checks if a type string represents a nested listener class
 * @param type - Type string, potentially in format "ParentClass.NestedClass"
 * @returns true if the type contains a dot indicating a nested class
 */
function isNestedListenerClass(type: string | undefined): boolean {
  return typeof type === 'string' && type.includes('.');
}

/**
 * Restores a nested listener instance from memento data
 * @param memento - The object item containing nested listener data
 * @param parentObj - The parent object that owns this nested listener
 * @param registry - Registry for resolving references
 * @returns The restored nested listener instance
 */
function restoreNestedListener(
  memento: { type?: string; primitives?: Record<string, PrimitiveValue>; references?: Record<string, string> },
  parentObj: any,
  registry: MementoRegistry
): any {
  if (!memento.type) {
    throw new MementoError(
      'Nested listener memento must have a type',
      'restoreNestedListener'
    );
  }

  const [parentType, nestedType] = memento.type.split('.');

  // Nested class constructors are created during parent object construction
  // Since we use Object.create() to restore objects (which skips constructor),
  // the nested class definitions aren't available on the restored object.
  //
  // Solution: Create a temporary instance to access the nested constructor,
  // or require the parent to expose nested classes via a static method/property.

  // First, try to access from a global registry or parent constructor
  const parentConstructor = (globalThis as any)[parentType];
  if (!parentConstructor) {
    throw new MementoError(
      `Cannot find parent constructor: ${parentType}`,
      'restoreNestedListener'
    );
  }

  // Try to get nested constructor from a static property on parent constructor
  let nestedConstructor = parentConstructor[nestedType];

  // If not available statically, we need to create a temporary instance
  // to access the nested class definition
  if (!nestedConstructor || typeof nestedConstructor !== 'function') {
    // Check if it's available on the parent object itself (after constructor ran)
    nestedConstructor = (parentObj as any)[nestedType];
  }

  if (!nestedConstructor || typeof nestedConstructor !== 'function') {
    throw new MementoError(
      `Cannot find nested constructor: ${nestedType} in ${parentType}. ` +
      `To support nested listener restoration, either:
      1. Expose the nested class as a static property on ${parentType}
      2. Implement restoreFromMemento() to manually recreate nested listeners
      3. Make the nested class globally accessible`,
      'restoreNestedListener'
    );
  }

  // Create instance - nested listeners typically receive id and parent as constructor params
  // Looking at the pattern: new this.InsertionOrderListener(`${id}_insertionOrder`, this)
  // We need to extract the id from primitives
  const listenerId = memento.primitives?.id as string;
  const listenerInstance = new nestedConstructor(listenerId, parentObj);

  // Restore primitives (skip 'id' since it was used in constructor)
  if (memento.primitives) {
    for (const [key, value] of Object.entries(memento.primitives)) {
      if (key !== 'id') {  // Skip id as it's set by constructor via super()
        listenerInstance[key] = value;
      }
    }
  }

  // Restore references
  if (memento.references) {
    for (const [key, refId] of Object.entries(memento.references)) {
      const ref = registry.get(refId);
      if (ref === undefined) {
        throw new MementoError(
          `Missing reference ${refId}`,
          'restoreNestedListener'
        );
      }
      listenerInstance[key] = ref;
    }
  }

  return listenerInstance;
}

