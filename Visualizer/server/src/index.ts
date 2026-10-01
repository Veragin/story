import { createApp } from './app';

const HOST = '0.0.0.0';
const PORT = Number(process.env.PORT ?? 8123);

const app = await createApp();
await app.listen(PORT, HOST);
console.log(`[visualizer-server] listening on http://${HOST}:${PORT} — stories in ${app.stories.root}`);
const ids = (await app.stories.list()).map((s) => s.id);
console.log(`[visualizer-server] stories (${ids.length}): ${ids.join(', ') || 'none'}`);

const shutdown = async () => {
    try {
        await app.close();
        process.exit(0);
    } catch {
        process.exit(1);
    }
};
process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
