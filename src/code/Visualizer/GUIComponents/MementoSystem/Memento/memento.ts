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
import { getObjectTypeName, getEnumerableProperties, hasCircularReference } from './mementoUtils';
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
    id: obj.getMementoId(),
    type: getObjectTypeName(obj),
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