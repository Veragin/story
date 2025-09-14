import { PropertyProcessor, PropertyProcessResult, MementoContext, MementoCollection, PrimitiveValue } from '../mementoTypes';
import { TypeGuards } from '../TypeGuards';
import { PrimitiveProcessor } from './PrimitiveProcessor';
import { WithMementoProcessor } from './WithMementoProcessor';

/**
 * Processor for handling array properties in memento creation.
 * Handles: arrays by separating primitives from object references
 */
export class ArrayProcessor implements PropertyProcessor {
  
  /**
   * Determines if this processor can handle the given value.
   * Returns true for array values.
   */
  canProcess(value: any): boolean {
    return TypeGuards.isArray(value);
  }
  
  /**
   * Processes an array property value.
   * Separates primitives from WithMemento object references.
   * Currently only handles primitives and WithMemento objects, skips other types.
   */
  process(
    propertyName: string, 
    value: any, 
    context: MementoContext
  ): PropertyProcessResult {
    // Validate that we can actually process this value
    if (!this.canProcess(value)) {
      throw new Error(`ArrayProcessor cannot process non-array value`);
    }
    
    const array = value as any[];
    const primitives: PrimitiveValue[] = [];
    const references: string[] = [];
    const newlyRegistered: string[] = [];
    
    const primitiveProcessor = new PrimitiveProcessor();
    const withMementoProcessor = new WithMementoProcessor();
    
    for (const element of array) {
      if (primitiveProcessor.canProcess(element)) {
        // Handle primitive elements
        const result = primitiveProcessor.process('arrayElement', element, context);
        if (result.shouldInclude && 'primitiveValue' in result) {
          primitives.push(result.primitiveValue!);
        }
      } else if (withMementoProcessor.canProcess(element)) {
        // Handle WithMemento elements
        const result = withMementoProcessor.process('arrayElement', element, context);
        if (result.shouldInclude && result.referenceId !== undefined) {
          references.push(result.referenceId);
        }
        if (result.newlyRegistered && result.newlyRegistered.length > 0) {
          newlyRegistered.push(...result.newlyRegistered);
        }
      }
      // Skip other types (plain objects, nested arrays, etc.)
    }
    
    const collection: MementoCollection = {
      type: 'array',
      primitives,
      references
    };
    
    return {
      shouldInclude: true,
      collection,
      newlyRegistered
    };
  }
}