import { MementoRecord } from './Memento/mementoTypes';

export class MementoJsonSerializer {

  /**
   * Serialize a memento record to JSON string
   */
  static serialize(memento: MementoRecord): string {
    return JSON.stringify(memento, (key, value) => {
      // Handle Date objects
      if (value instanceof Date) {
        return { __type: 'Date', value: value.toISOString() };
      }
      return value;
    });
  }

  /**
   * Deserialize JSON string to memento record
   */
  static deserialize(json: string): MementoRecord {
    return JSON.parse(json, (key, value) => {
      // Handle Date objects
      if (value && typeof value === 'object' && value.__type === 'Date') {
        return new Date(value.value);
      }
      return value;
    });
  }

  /**
   * Serialize multiple memento records to JSON string
   */
  static serializeMany(mementos: MementoRecord[]): string {
    return JSON.stringify(mementos.map(m => this.serialize(m)));
  }

  /**
   * Deserialize JSON string to multiple memento records
   */
  static deserializeMany(json: string): MementoRecord[] {
    const serializedMementos = JSON.parse(json) as string[];
    return serializedMementos.map(m => this.deserialize(m));
  }
}