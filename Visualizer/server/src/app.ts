import { createServer, type Server } from 'node:http';
import type { FSWatcher } from 'chokidar';
import type { TServerContext } from './context';
import { EventBus } from './events/EventBus';
import { startWatcher } from './events/watcher';
import { Router } from './http/router';
import { ProjectRoot } from './project/ProjectRoot';
import { registerRoutes } from './routes';

export type TAppOptions = {
    project?: ProjectRoot;
    /** Start the chokidar watcher behind `/api/events` (default true). */
    watch?: boolean;
    batchMs?: number;
};

export type TApp = TServerContext & {
    server: Server;
    /** Start listening; resolves with the bound port (pass 0 for an ephemeral one in tests). */
    listen(port: number, host?: string): Promise<number>;
    close(): Promise<void>;
};

/**
 * Build the server without starting it: the router with every protocol route registered, the
 * event bus and (optionally) the watcher. `index.ts` is the process entry; tests call this with a
 * temp `ProjectRoot`.
 */
export const createApp = async ({
    project = ProjectRoot.fromEnv(),
    watch = true,
    batchMs,
}: TAppOptions = {}): Promise<TApp> => {
    const router = new Router();
    const bus = new EventBus({ project, batchMs });
    let watcher: FSWatcher | null = null;
    const ctx: TServerContext = { project, bus, router, watching: () => watcher !== null };

    registerRoutes(ctx);
    const missing = router.missing();
    if (missing.length > 0) {
        throw new Error(`Protocol routes without a handler: ${missing.join(', ')}`);
    }

    if (watch) watcher = await startWatcher(bus);

    const server = createServer((req, res) => void router.dispatch(req, res));

    return {
        ...ctx,
        server,
        listen: (port, host = '0.0.0.0') =>
            new Promise<number>((resolve, reject) => {
                server.once('error', reject);
                server.listen(port, host, () => {
                    const address = server.address();
                    resolve(typeof address === 'object' && address ? address.port : port);
                });
            }),
        close: async () => {
            await watcher?.close();
            watcher = null;
            await bus.close();
            server.closeAllConnections();
            await new Promise<void>((resolve) => (server.listening ? server.close(() => resolve()) : resolve()));
        },
    };
};
