import { MementoOptions } from './Memento/mementoTypes';

export interface MementoSystemOptions {
  /**
   * Default options for memento creation
   */
  defaultMementoOptions?: Partial<MementoOptions>;

  /**
   * Whether to auto-save when objects are registered
   */
  autoSave?: boolean;

  /**
   * Whether to validate memento integrity on load
   */
  validateOnLoad?: boolean;
}