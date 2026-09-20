import { PropertyProcessor, PropertyProcessResult, MementoContext, PrimitiveValue } from '../mementoTypes';
import { TypeGuards } from '../TypeGuards';

/**
 * Processor for handling primitive values in memento creation.
 * Handles: string, number, boolean, null, undefined, Date
 */
export class PrimitiveProcessor implements PropertyProcessor {
  
  /**
   * Determines if this processor can handle the given value.
   * Returns true for primitive values (string, number, boolean, null, undefined, Date).
   */
  canProcess(value: any): boolean {
    return TypeGuards.isPrimitive(value);
  }
  
  /**
   * Processes a primitive property value.
   * Since primitives are stored directly, this simply returns the value
   * with shouldInclude set to true.
   */
  process(
    propertyName: string, 
    value: any, 
    context: MementoContext
  ): PropertyProcessResult {
    // Validate that we can actually process this value
    if (!this.canProcess(value)) {
      throw new Error(`PrimitiveProcessor cannot process non-primitive value: ${typeof value}`);
    }
    
    // For primitive values, we store them directly
    return {
      shouldInclude: true,
      primitiveValue: value as PrimitiveValue,
      newlyRegistered: []
    };
  }
}