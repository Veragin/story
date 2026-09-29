import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/** Absolute path of `p`, resolved against this config file (i.e. `Visualizer/client/`). */
const at = (p: string) => fileURLToPath(new URL(p, import.meta.url));

/** The monorepo root. Everything this app imports lives under it, none of it under `root`. */
const repoRoot = at('../..');

/**
 * The internal packages this app pulls source out of — all of them outside `root`.
 *
 * `data/` (and `core/`) are deliberately NOT here (Visualizer plan §3 "Live refresh", point 1):
 * the Visualizer never runs the story, it gets it from `Visualizer/server` over `/api`. If
 * `data/` were watched, or in the module graph, every edit of a story file — by hand or by the
 * server — would fully reload the page and lose the camera, selection and unsaved input. The
 * lint rule in `eslint.config.js` keeps runtime `@story/data` / `@story/core` imports out of the
 * client; `types/` stays, because type-only imports resolve through it. Both are the example
 * story's folders (`stories/example/`, multiple stories phase 2): the one story the client's
 * type-only imports are checked against.
 */
const siblingPackages = ['../../stories/example/types', '../../shared', '../../ui', '../protocol'].map(at);

/**
 * Vite seeds its watcher with `root` only; anything outside is added lazily, the first time a
 * module is transformed. That is enough to hot-reload a file that is already in the graph, but
 * a *new* file is never seen — so adding `data/chapters/…/newPassage.ts` would not invalidate
 * the chapter barrel that is about to import it. Seeding the sibling packages up front closes
 * the gap (§7, §10 risk 4).
 */
const watchSiblingPackages = () => ({
    name: 'story:watch-sibling-packages',
    configureServer(server: { watcher: { add: (paths: string[]) => void } }) {
        server.watcher.add(siblingPackages);
    },
});

/**
 * Deliberately near-identical to `SingleEngine/vite.config.ts`: §7 is "one config per app, no
 * shared root config", so the duplication is the intent — each app states its own edges and can
 * diverge (ports, proxies, the `Visualizer/server` `/api` proxy of §8) without a shared file
 * turning into a second place to reason about.
 */
// https://vitejs.dev/config/
export default defineConfig({
    /**
     * The public path the app is served under: `/` in dev, `/visualizer/` behind the production
     * proxy (`docker-compose.prod.yml`, `VISUALIZER_BASE=/visualizer/`, with both slashes). Only
     * the built asset URLs move: routing is the hash (`#/map`), and every API call is the absolute
     * `/api/…`, so it still reaches the server at the origin's root, never `/visualizer/api`.
     */
    base: process.env.VISUALIZER_BASE || '/',
    assetsInclude: ['**/*.png', '**/*.jpg'],
    // No static-serve root. Story art (the `.png` next to a passage / character / npc file) is
    // not bundled here: the Visualizer never imports `data/`, it shows the art through the
    // server's `/api/stories/<id>/images/…` routes. Only the favicon (`stories/example/data/assets/story.png`)
    // is bundled.
    publicDir: false,
    plugins: [react(), watchSiblingPackages()],
    resolve: {
        /**
         * Explicit source aliases rather than `vite-tsconfig-paths` (§7) — the plugin, and the
         * legacy Visualizer `baseUrl` path alias it existed to resolve, both go away with this
         * phase: the app resolves its own files relatively now.
         *
         * Order matters: `@rollup/plugin-alias` treats a string `find` as a prefix, so a bare
         * `@story/ui` entry would also swallow `@story/ui/index.css` and rewrite it to
         * `ui/src/index.ts/index.css`. Every subpath a package publishes through `exports` is
         * therefore listed ahead of its bare name.
         */
        alias: [
            { find: '@story/ui/index.css', replacement: at('../../ui/src/index.css') },
            { find: '@story/ui', replacement: at('../../ui/src/index.ts') },

            // No `@story/data` / `@story/core` aliases on purpose: the client imports them
            // type-only (Visualizer plan §3 "Live refresh"), so they must never be resolved.

            { find: '@story/visualizer-protocol', replacement: at('../protocol/src/index.ts') },
            { find: '@story/types', replacement: at('../../stories/example/types/index.ts') },
            { find: '@story/shared', replacement: at('../../shared/src/index.ts') },
        ],
    },
    server: {
        host: '0.0.0.0',
        port: 8101,
        strictPort: true,
        fs: {
            // `root` is `Visualizer/client/`, so every internal package is outside it and would
            // be refused by the dev server's file-serving guard (§10 risk 4).
            allow: [repoRoot],
        },
        // The sibling packages are added to this watcher by `watchSiblingPackages` above;
        // `ignored` keeps that from dragging in the workspace symlink farm or build output.
        watch: {
            ignored: ['**/node_modules/**', '**/.git/**', '**/dist/**'],
        },
        /**
         * `Visualizer/server` (plan §1): every API call is same-origin `/api/...`, so the
         * client has no hard-coded server URL and no CORS. Includes each story's `/api/stories/<id>/events` SSE stream
         * (http-proxy streams it through unbuffered). `VISUALIZER_SERVER` overrides the target.
         *
         * The browser's `Cookie` (the `story_session` login) and `Origin` headers pass through
         * untouched. `changeOrigin` stays off so `Host` does too: the server's CSRF check accepts a
         * mutation whose `Origin` matches its `Host`, so the client works under any host name
         * (`localhost`, `127.0.0.1`, a LAN address), not just the `ALLOWED_ORIGINS` defaults.
         */
        proxy: {
            '/api': {
                target: process.env.VISUALIZER_SERVER ?? 'http://localhost:8123',
            },
        },
    },
});
