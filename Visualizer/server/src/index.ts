/**
 * `@story/visualizer-server` — the Visualizer's backend on :8123 (plan §1, §3).
 *
 * It reads and writes the author's `data/` and `types/` as TypeScript *source* (ts-morph, WP2) —
 * it never imports the story — and pushes change notices over `GET /events`. The client
 * reaches it through Vite's `/api` proxy (`Visualizer/client/vite.config.ts`).
 *
 * Every protocol route is implemented (WP1 skeleton, WP2 source reader/writer and JSON stores);
 * see `Visualizer/README.md` for how the writer works.
 *
 * Env: `STORIES_ROOT` — the folder holding one folder per story (default: `<repo>/stories`; a
 *      relative path is resolved against the repo root).
 *      `PORT` — default 8123.
 *      `COOKIE_SECURE` — `1` marks the `story_session` cookie `Secure` (behind HTTPS).
 *      `ALLOWED_ORIGINS` — comma-separated origins a mutation may come from (default: the dev
 *      ports on localhost / 127.0.0.1, see `auth/csrf.ts`).
 *      `TRUST_PROXY` — `1` keys the login limiter on the last `X-Forwarded-For` hop (behind a
 *      reverse proxy that alone can reach this server, see `auth/LoginLimiter.ts#clientAddress`).
 */
import { createApp } from './app';

const HOST = '0.0.0.0'; // reachable from outside the container, like every other service (§7)
const PORT = Number(process.env.PORT ?? 8123);

const app = await createApp();
await app.listen(PORT, HOST);
console.log(`[visualizer-server] listening on http://${HOST}:${PORT} — stories in ${app.stories.root}`);
const ids = (await app.stories.list()).map((s) => s.id);
console.log(`[visualizer-server] stories (${ids.length}): ${ids.join(', ') || 'none'}`);

const shutdown = () => {
    app.close().then(
        () => process.exit(0),
        () => process.exit(1)
    );
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
