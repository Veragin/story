import { PropertyDescriptor, PropertyType } from './mementoTypes';
import { TypeGuards } from './TypeGuards';

export function getObjectTypeName(obj: any): string {
  if (obj === null) return 'null';
  if (obj === undefined) return 'undefined';
  
  // Try to get constructor name
  if (obj.constructor && obj.constructor.name) {
    return obj.constructor.name;
  }
  
  // Fallback to toString
  const toString = Object.prototype.toString.call(obj);
  return toString.slice(8, -1); // Extract type from "[object Type]"
}

export function getEnumerableProperties(obj: any): PropertyDescriptor[] {
  const properties: PropertyDescriptor[] = [];
  
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const value = obj[key];
      properties.push({
        name: key,
        value: value,
        type: classifyPropertyType(value)
      });
    }
  }
  
  return properties;
}

function classifyPropertyType(value: any): PropertyType {
  if (TypeGuards.isPrimitive(value)) {
    return PropertyType.Primitive;
  }
  
  if (TypeGuards.isWithMemento(value)) {
    return PropertyType.WithMemento;
  }
  
  if (TypeGuards.isArray(value)) {
    return PropertyType.Array;
  }
  
  if (TypeGuards.isPlainObject(value)) {
    return PropertyType.PlainObject;
  }
  
  return PropertyType.Unknown;
}

export function hasCircularReference(obj: any, visited: Set<any>): boolean {
  return visited.has(obj);
}