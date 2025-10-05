import { WithMemento, MementoRecord, MementoRegistry } from './Memento/mementoTypes';


/**
 * Interface for listeners that can be stored in memento system
 */
export interface IMementoAwareListener<T> extends WithMemento {
  onNotify(data: T): void;
}

/**
 * Observer that can be stored in the memento system
 * Holds references to listeners which are also WithMemento objects
 */
export class MementoAwareObserver<T> implements WithMemento {
  private id: string;
  public listeners: IMementoAwareListener<T>[] = [];

  constructor(id: string) {
    this.id = id;
  }

  getId(): string {
    return this.id;
  }

  getObjectTypeName(): string {
    return this.constructor.name;
  }

  subscribe(listener: IMementoAwareListener<T>): void {
    // Don't add duplicates
    if (!this.listeners.find(l => l.getId() === listener.getId())) {
      this.listeners.push(listener);
    }
  }

  unsubscribe(listener: IMementoAwareListener<T>): void {
    this.listeners = this.listeners.filter(
      l => l.getId() !== listener.getId()
    );
  }

  notify(data: T): void {
    this.listeners.forEach(listener => listener.onNotify(data));
  }
}