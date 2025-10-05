import { PropertyProcessor, PropertyProcessResult, MementoContext } from '../mementoTypes';
import { TypeGuards } from '../TypeGuards';

/**
 * Processor for handling plain object properties in memento creation.
 * Currently skips plain objects as per requirements.
 * Note: Nested listener classes (which are plain objects) are handled by ArrayProcessor.
 */
export class PlainObjectProcessor implements PropertyProcessor {

  /**
   * Determines if this processor can handle the given value.
   * Returns true for plain object values.
   */
  canProcess(value: any): boolean {
    return TypeGuards.isPlainObject(value);
  }

  /**
   * Processes a plain object property value.
   * Currently skips all plain objects as per requirements.
   */
  process(
    _propertyName: string,
    value: any,
    _context: MementoContext
  ): PropertyProcessResult {
    // Validate that we can actually process this value
    if (!this.canProcess(value)) {
      throw new Error(`PlainObjectProcessor cannot process non-plain-object value`);
    }

    // Currently skip plain objects as per requirements
    return {
      shouldInclude: false,
      newlyRegistered: []
    };
  }
}