import { IMementoAwareListener } from './MementoAwareObserver';
import { WithMemento, MementoRecord, MementoRegistry } from './Memento/mementoTypes';

/**
 * Base class for MementoAware listeners that can be stored and restored.
 * Subclasses need to be registered globally or in a type registry for restoration.
 */
export abstract class BaseMementoAwareListener<T> implements IMementoAwareListener<T> {
  protected id: string;

  constructor(id: string) {
    this.id = id;
  }

  getId(): string {
    return this.id;
  }

  getObjectTypeName(): string {
    return this.constructor.name;
  }

  abstract onNotify(data: T): void;
}