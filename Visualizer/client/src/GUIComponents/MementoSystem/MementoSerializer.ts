import { MementoRecord } from './Memento/mementoTypes';

/**
 * Handles serialization and deserialization of memento records to/from JSON
 */
export class MementoSerializer {

  /**
   * Serialize a memento record to JSON string
   */
  serialize(memento: MementoRecord): string {
    return JSON.stringify({
      id: memento.id,
      type: memento.type,
      primitives: this.serializePrimitives(memento.primitives),
      references: memento.references,
      collections: memento.collections,
      timestamp: memento.timestamp
    });
  }

  /**
   * Deserialize a JSON string to memento record
   */
  deserialize(json: string): MementoRecord {
    const data = JSON.parse(json);
    return {
      id: data.id,
      type: data.type,
      primitives: this.deserializePrimitives(data.primitives),
      references: data.references,
      collections: data.collections,
      timestamp: data.timestamp
    };
  }

  private serializePrimitives(primitives: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(primitives)) {
      if (value instanceof Date) {
        result[key] = { __type: 'Date', value: value.toISOString() };
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  private deserializePrimitives(primitives: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(primitives)) {
      if (value && typeof value === 'object' && value.__type === 'Date') {
        result[key] = new Date(value.value);
      } else {
        result[key] = value;
      }
    }
    return result;
  }
}