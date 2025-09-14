import { MementoRecord } from './Memento/mementoTypes';

/**
 * Interface for persistent storage of memento records
 */
export interface MementoStorage {
  /**
   * Load all memento IDs from storage
   */
  loadMementoIds(): Promise<string[]>;

  /**
   * Load a specific memento record by ID
   */
  loadMemento(id: string): Promise<MementoRecord | undefined>;

  /**
   * Save a memento record to storage
   */
  saveMemento(memento: MementoRecord): Promise<void>;

  /**
   * Remove a memento from storage
   */
  remove(id: string): Promise<boolean>;

  /**
   * Clear all mementos from storage
   */
  clear(): Promise<void>;
}