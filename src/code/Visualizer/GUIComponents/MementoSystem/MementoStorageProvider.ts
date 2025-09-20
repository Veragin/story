import { MementoRecord } from './Memento/mementoTypes';

export interface MementoStorageProvider {
  /**
   * Load all memento IDs available in storage
   */
  loadMementoIds(): Promise<string[]>;

  /**
   * Load a specific memento by ID
   */
  loadMemento(id: string): Promise<MementoRecord | null>;

  /**
   * Save a memento to storage
   */
  saveMemento(memento: MementoRecord): Promise<boolean>;

  /**
   * Save multiple mementos to storage
   */
  saveMementos(mementos: MementoRecord[]): Promise<boolean>;

  /**
   * Delete a memento from storage
   */
  deleteMemento(id: string): Promise<boolean>;

  /**
   * Check if a memento exists in storage
   */
  exists(id: string): Promise<boolean>;
}