import { MementoRegistry, WithMemento } from './mementoTypes';

export class InMemoryMementoRegistry implements MementoRegistry {
  private objects = new Map<string, WithMemento>();
  
  isRegistered(id: string): boolean {
    return this.objects.has(id);
  }
  
  register(obj: WithMemento): boolean {
    const id = obj.getId();
    if (this.objects.has(id)) {
      return false;
    }
    this.objects.set(id, obj);
    return true;
  }
  
  get<T extends WithMemento>(id: string): T | undefined {
    return this.objects.get(id) as T | undefined;
  }
  
  getRegisteredIds(): string[] {
    return Array.from(this.objects.keys());
  }
  
  clear(): void {
    this.objects.clear();
  }
}