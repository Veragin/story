import chokidar, { type FSWatcher } from 'chokidar';
import { isTempFile } from '../json/atomicWrite';
import type { EventBus } from './EventBus';

// resolves after the initial scan, so any later change is seen
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
