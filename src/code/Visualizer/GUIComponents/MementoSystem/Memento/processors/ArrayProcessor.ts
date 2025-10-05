import { PropertyProcessor, PropertyProcessResult, MementoContext, MementoCollection, PrimitiveValue, MementoItem } from '../mementoTypes';
import { TypeGuards } from '../TypeGuards';
import { PrimitiveProcessor } from './PrimitiveProcessor';
import { WithMementoProcessor } from './WithMementoProcessor';
import { getEnumerableProperties } from '../mementoUtils';

/**
 * Processor for handling array properties in memento creation.
 * Handles: arrays by separating primitives from object references
 */
export class ArrayProcessor implements PropertyProcessor {

  canProcess(value: any): boolean {
    return TypeGuards.isArray(value);
  }

  /**
   * Checks if an object is a nested listener class instance
   */
  private isNestedListenerInstance(value: any): boolean {
    if (!value || typeof value !== 'object') return false;

    const proto = Object.getPrototypeOf(value);
    const constructor = proto?.constructor;

    // Check if it has an 'outer' property pointing to parent
    // This is the pattern used for nested listeners
    return constructor &&
           typeof constructor.name === 'string' &&
           'outer' in value;
  }

  /**
   * Gets the parent class name from a nested listener instance
   */
  private getParentClassName(listenerInstance: any): string {
    // Access the outer/parent object
    const parent = listenerInstance.outer;
    if (parent && parent.constructor && parent.constructor.name) {
      return parent.constructor.name;
    }
    return '';
  }

  process(
    _propertyName: string,
    value: any,
    context: MementoContext
  ): PropertyProcessResult {
    if (!this.canProcess(value)) {
      throw new Error(`ArrayProcessor cannot process non-array value`);
    }

    const array = value as any[];
    const items: MementoItem[] = [];
    const newlyRegistered: string[] = [];

    const primitiveProcessor = new PrimitiveProcessor();
    const withMementoProcessor = new WithMementoProcessor();

    for (const element of array) {
      if (primitiveProcessor.canProcess(element)) {
        const result = primitiveProcessor.process('arrayElement', element, context);
        if (result.shouldInclude && result.primitiveValue !== undefined) {
          items.push({ kind: 'primitive', value: result.primitiveValue });
        }
      } else if (this.isNestedListenerInstance(element)) {
        // Check for nested listeners BEFORE checking WithMemento
        // because nested listeners also implement WithMemento but need special handling
        const parentClassName = this.getParentClassName(element);
        const listenerClassName = element.constructor.name;
        const fullTypeName = `${parentClassName}.${listenerClassName}`;

        const itemPrimitives: Record<string, PrimitiveValue> = {};
        const itemReferences: Record<string, string> = {};

        // Get id from getId() method if available
        if (typeof element.getId === 'function') {
          itemPrimitives.id = element.getId();
        }

        // Extract other properties
        const subProperties = getEnumerableProperties(element);
        for (const subProp of subProperties) {
          if (subProp.name === 'outer') continue; // Skip outer reference

          if (primitiveProcessor.canProcess(subProp.value)) {
            const res = primitiveProcessor.process(subProp.name, subProp.value, context);
            if (res.shouldInclude && res.primitiveValue !== undefined) {
              itemPrimitives[subProp.name] = res.primitiveValue;
            }
          } else if (withMementoProcessor.canProcess(subProp.value)) {
            const res = withMementoProcessor.process(subProp.name, subProp.value, context);
            if (res.shouldInclude && res.referenceId !== undefined) {
              itemReferences[subProp.name] = res.referenceId;
            }
            if (res.newlyRegistered?.length) {
              newlyRegistered.push(...res.newlyRegistered);
            }
          }
        }

        items.push({
          kind: 'object',
          type: fullTypeName,
          primitives: itemPrimitives,
          references: itemReferences
        });
      } else if (withMementoProcessor.canProcess(element)) {
        const result = withMementoProcessor.process('arrayElement', element, context);
        if (result.shouldInclude && result.referenceId !== undefined) {
          items.push({ kind: 'reference', id: result.referenceId });
        }
        if (result.newlyRegistered?.length) {
          newlyRegistered.push(...result.newlyRegistered);
        }
      } else if (TypeGuards.isPlainObject(element)) {
        // Handle regular plain objects (nested listeners are handled above)
        const itemPrimitives: Record<string, PrimitiveValue> = {};
        const subProperties = getEnumerableProperties(element);

        for (const subProp of subProperties) {
          if (primitiveProcessor.canProcess(subProp.value)) {
            const res = primitiveProcessor.process(subProp.name, subProp.value, context);
            if (res.shouldInclude && res.primitiveValue !== undefined) {
              itemPrimitives[subProp.name] = res.primitiveValue;
            }
          }
          // Skip nested non-primitives
        }

        if (Object.keys(itemPrimitives).length > 0) {
          items.push({ kind: 'object', primitives: itemPrimitives });
        }
      }
      // Skip other types (nested arrays, etc.)
    }

    const collection: MementoCollection = {
      type: 'array',
      items,
    };

    return {
      shouldInclude: true,
      collection,
      newlyRegistered,
    };
  }
}