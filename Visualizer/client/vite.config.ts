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
 * client; `types/` stays, because type-only imports resolve through it.
 */
const siblingPackages = ['../../types', '../../shared', '../../ui', '../protocol'].map(at);

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
    assetsInclude: ['**/*.png', '**/*.jpg'],
    // No static-serve root: story art moved out of `public/` into `data/assets/` (§3) and is
    // pulled in through the bundler by `data/assets/index.ts`, so it gets hashed and validated
    // at build time instead of being copied verbatim.
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
            { find: '@story/types', replacement: at('../../types/index.ts') },
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
         * client has no hard-coded server URL and no CORS. Includes the `/api/events` SSE stream
         * (http-proxy streams it through unbuffered). `VISUALIZER_SERVER` overrides the target.
         */
        proxy: {
            '/api': {
                target: process.env.VISUALIZER_SERVER ?? 'http://localhost:8123',
                changeOrigin: true,
            },
        },
    },
});
