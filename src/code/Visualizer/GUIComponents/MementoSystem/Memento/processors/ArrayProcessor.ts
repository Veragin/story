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

  process(
    propertyName: string,
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
      } else if (withMementoProcessor.canProcess(element)) {
        const result = withMementoProcessor.process('arrayElement', element, context);
        if (result.shouldInclude && result.referenceId !== undefined) {
          items.push({ kind: 'reference', id: result.referenceId });
        }
        if (result.newlyRegistered?.length) {
          newlyRegistered.push(...result.newlyRegistered);
        }
      } else if (TypeGuards.isPlainObject(element)) {
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