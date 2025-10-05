import { MementoRecord, PropertyDescriptor, PropertyType } from './mementoTypes';
import { TypeGuards } from './TypeGuards';

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