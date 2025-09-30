import { PropertyProcessor, PropertyProcessResult, MementoContext } from '../mementoTypes';
import { TypeGuards } from '../TypeGuards';

/**
 * Processor for handling WithMemento objects in memento creation.
 * Handles: objects implementing WithMemento interface
 * - Checks registry status
 * - Auto-registers if configured
 * - Stores object references by ID
 */
export class WithMementoProcessor implements PropertyProcessor {
  
  /**
   * Determines if this processor can handle the given value.
   * Returns true for objects implementing WithMemento interface.
   */
  canProcess(value: any): boolean {
    return TypeGuards.isWithMemento(value);
  }
  
  /**
   * Processes a WithMemento property value.
   * Checks registry status and optionally auto-registers the object.
   * Returns a reference ID if the object is registered, otherwise skips.
   */
  process(
    propertyName: string, 
    value: any, 
    context: MementoContext
  ): PropertyProcessResult {
    // Validate that we can actually process this value
    if (!this.canProcess(value)) {
      throw new Error(`WithMementoProcessor cannot process non-WithMemento value`);
    }
    
    const objectId = value.getId();
    const newlyRegistered: string[] = [];
    
    // Check if object is already registered
    if (!context.registry.isRegistered(objectId)) {
      // Auto-register if configured
      if (context.options.autoRegister) {
        const registered = context.registry.register(value);
        if (registered) {
          newlyRegistered.push(objectId);
        }
      } else {
        // Skip unregistered objects if auto-register is disabled
        return {
          shouldInclude: false,
          newlyRegistered: []
        };
      }
    }
    
    // Object is registered (either already or just auto-registered)
    if (context.registry.isRegistered(objectId)) {
      return {
        shouldInclude: true,
        referenceId: objectId,
        newlyRegistered
      };
    }
    
    // Should not reach here, but handle gracefully
    return {
      shouldInclude: false,
      newlyRegistered
    };
  }
}