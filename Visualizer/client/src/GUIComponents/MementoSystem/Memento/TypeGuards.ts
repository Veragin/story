import { PrimitiveValue, WithMemento } from './mementoTypes';

export class TypeGuards {
  static isPrimitive(value: any): value is PrimitiveValue {
    if (value === null || value === undefined) {
      return true;
    }
    
    const type = typeof value;
    if (type === 'string' || type === 'number' || type === 'boolean') {
      return true;
    }
    
    return value instanceof Date;
  }
  
  static isWithMemento(value: any): value is WithMemento {
    return value != null && 
           typeof value === 'object' && 
           typeof value.getMementoId === 'function';
  }
  
  static isArray(value: any): value is any[] {
    return Array.isArray(value);
  }
  
  static isPlainObject(value: any): boolean {
    if (value === null || typeof value !== 'object') {
      return false;
    }
    
    // Check if it's a plain object (not an instance of a class)
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
  }
}