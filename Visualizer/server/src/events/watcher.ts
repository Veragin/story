import chokidar, { type FSWatcher } from 'chokidar';
import { isTempFile } from '../json/atomicWrite';
import type { EventBus } from './EventBus';

/**
 * Watch the author's two folders and feed every file change into the bus, which batches them into
 * resource events (plan §3 "Live refresh", point 2). Resolves once the initial scan is done, so a
 * change made after `await startWatcher(...)` is always seen.
 */
export const startWatcher = async (bus: EventBus): Promise<FSWatcher> => {
    const { dataDir, typesDir } = bus.project;
    const watcher = chokidar.watch([dataDir, typesDir], {
        ignoreInitial: true,
        ignored: (file) => file.includes('/node_modules/') || file.endsWith('/node_modules') || isTempFile(file),
    });
    watcher.on('add', (file) => bus.fileChanged(file, 'add'));
    watcher.on('change', (file) => bus.fileChanged(file, 'change'));
    watcher.on('unlink', (file) => bus.fileChanged(file, 'unlink'));
    watcher.on('error', (e) => console.error('[visualizer-server] watcher error', e));
    await new Promise<void>((resolve) => watcher.once('ready', () => resolve()));
    return watcher;
};
