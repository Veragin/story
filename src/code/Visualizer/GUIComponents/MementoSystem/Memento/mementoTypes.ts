/**
 * CORE INTERFACES AND TYPES
 */

// Base interface that objects must implement to be memento-able
export interface WithMemento {
  getMementoId(): string;
  restoreFromMemento?: (memento: MementoRecord, registry: MementoRegistry) => void;
}

// Structure for storing primitive values and object references
export interface MementoRecord {
  readonly id: string;                    // ID of the object this memento represents
  readonly type: string;                  // Type/class name for reconstruction
  readonly primitives: Record<string, PrimitiveValue>;  // Direct primitive values
  readonly references: Record<string, string>;          // Property name -> referenced object ID
  readonly collections: Record<string, MementoCollection>; // Arrays/Sets/Maps
  readonly timestamp: number;             // When memento was created
}

// Supported primitive types that can be stored directly
export type PrimitiveValue = string | number | boolean | null | undefined | Date;

// Collection handling for arrays and other iterable structures
export interface MementoCollection {
  type: 'array' | 'set' | 'map';
  items: MementoItem[];
}

export interface MementoItem {
  kind: 'primitive' | 'reference' | 'object';
  value?: PrimitiveValue;
  id?: string;
  primitives?: Record<string, PrimitiveValue>;
}

// Registry interface for dependency injection
export interface MementoRegistry {
  // Check if object is already registered
  isRegistered(id: string): boolean;
  
  // Register a new object (returns false if already exists)
  register(obj: WithMemento): boolean;
  
  // Retrieve registered object by ID
  get<T extends WithMemento>(id: string): T | undefined;
  
  // Get all registered IDs
  getRegisteredIds(): string[];
  
  // Clear registry (useful for testing)
  clear(): void;
}

// Configuration for memento creation behavior
export interface MementoOptions {
  // Whether to auto-register unregistered WithMemento objects
  autoRegister: boolean;
  
  // Maximum depth to prevent infinite recursion
  maxDepth: number;
  
  // Custom type checker for determining if object should be mementoed
  shouldMementoObject?: (obj: any) => boolean;
  
  // Skip certain property names
  skipProperties?: string[];
}

// Context object passed through recursive calls
export interface MementoContext {
  readonly registry: MementoRegistry;
  readonly options: MementoOptions;
  readonly visitedObjects: Set<any>;     // Circular reference prevention
  readonly currentDepth: number;
}

// Result of attempting to create a memento
export interface MementoResult {
  success: boolean;
  memento?: MementoRecord;
  error?: string;
  skippedProperties: string[];           // Properties that were skipped
  autoRegisteredIds: string[];          // Objects that were auto-registered
}

// Helper for determining property types at runtime
export interface PropertyDescriptor {
  name: string;
  value: any;
  type: PropertyType;
}

export enum PropertyType {
  Primitive,
  WithMemento,
  Array,
  PlainObject,
  Unknown
}

// Strategy pattern for handling different property types
export interface PropertyProcessor {
  canProcess(value: any): boolean;
  process(
    propertyName: string, 
    value: any, 
    context: MementoContext
  ): PropertyProcessResult;
}

export interface PropertyProcessResult {
  shouldInclude: boolean;
  primitiveValue?: PrimitiveValue;
  referenceId?: string;
  collection?: MementoCollection;
  newlyRegistered?: string[];
}