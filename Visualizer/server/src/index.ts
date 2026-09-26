/**
 * `@story/visualizer-server` — the Visualizer's backend on :8123 (plan §1, §3).
 *
 * It reads and writes the author's `data/` and `types/` as TypeScript *source* (ts-morph, WP2) —
 * it never imports the story — and pushes change notices over `GET /api/events`. The client
 * reaches it through Vite's `/api` proxy (`Visualizer/client/vite.config.ts`).
 *
 * WP1 state: routing, JSON bodies, error mapping, `/api/health`, the watcher + SSE feed, atomic
 * writes and the transaction bus are real; every other protocol route answers 501 until WP2.
 *
 * Env: `STORY_ROOT` — the project root holding `data/` and `types/` (default: the repo root).
 *      `PORT` — default 8123.
 */
import { createApp } from './app';

const HOST = '0.0.0.0'; // reachable from outside the container, like every other service (§7)
const PORT = Number(process.env.PORT ?? 8123);

const app = await createApp();
await app.listen(PORT, HOST);
console.log(`[visualizer-server] listening on http://${HOST}:${PORT} — project root ${app.project.root}`);
console.log(`[visualizer-server] watching ${app.project.dataDir} and ${app.project.typesDir} for /api/events`);

const shutdown = () => {
    app.close().then(
        () => process.exit(0),
        () => process.exit(1)
    );
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
