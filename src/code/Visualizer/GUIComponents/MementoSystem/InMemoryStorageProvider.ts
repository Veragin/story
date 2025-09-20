import { MementoStorageProvider } from './MementoStorageProvider';
import { MementoJsonSerializer } from './MementoJsonSerializer';
import { MementoRecord } from './Memento/mementoTypes';

export class InMemoryStorageProvider implements MementoStorageProvider {
  private storage: Map<string, string> = new Map();

  async loadMementoIds(): Promise<string[]> {
    return Array.from(this.storage.keys());
  }

  async loadMemento(id: string): Promise<MementoRecord | null> {
    const json = this.storage.get(id);
    if (!json) return null;

    try {
      return MementoJsonSerializer.deserialize(json);
    } catch (error) {
      console.error(`Failed to deserialize memento ${id}:`, error);
      return null;
    }
  }

  async saveMemento(memento: MementoRecord): Promise<boolean> {
    try {
      const json = MementoJsonSerializer.serialize(memento);
      this.storage.set(memento.id, json);
      return true;
    } catch (error) {
      console.error(`Failed to serialize memento ${memento.id}:`, error);
      return false;
    }
  }

  async saveMementos(mementos: MementoRecord[]): Promise<boolean> {
    try {
      for (const memento of mementos) {
        const json = MementoJsonSerializer.serialize(memento);
        this.storage.set(memento.id, json);
      }
      return true;
    } catch (error) {
      console.error('Failed to save mementos:', error);
      return false;
    }
  }

  async deleteMemento(id: string): Promise<boolean> {
    return this.storage.delete(id);
  }

  async exists(id: string): Promise<boolean> {
    return this.storage.has(id);
  }

  // Additional helper methods for testing
  clear(): void {
    this.storage.clear();
  }

  size(): number {
    return this.storage.size;
  }
}