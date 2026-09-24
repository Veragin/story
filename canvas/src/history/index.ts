/**
 * Undo/redo and object snapshotting (VISUALIZER_PLAN §3.2).
 *
 * Two halves that meet at `SnapshotCommand`:
 *
 *  - `History.ts` — the command stack. This is undo/redo, and it is new; see the header of that
 *    file for why the thing §1.1 called undo/redo was not.
 *  - `MementoSystem*` / `Memento/**` — the deep-snapshot and serialisation machinery moved
 *    verbatim from `GUIComponents/MementoSystem/**`, registry and processors intact.
 */

export * from './History';

export * from './MementoSystem';
export * from './MementoSystemOptions';
export * from './MementoSystemState';
export * from './MementoStorage';
export * from './MementoSerializer';
export * from './Memento/memento';
export * from './Memento/mementoTypes';
export * from './Memento/mementoUtils';
export * from './Memento/MementoError';
export * from './Memento/InMemoryMementoRegistry';
