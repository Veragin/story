import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/** Absolute path of `p`, resolved against this config file (i.e. `Visualizer/landing-page/`). */
const at = (p: string) => fileURLToPath(new URL(p, import.meta.url));

/** The monorepo root. Everything this app imports lives under it, none of it under `root`. */
const repoRoot = at('../..');

/**
 * The internal packages this app pulls source out of — all of them outside `root`. No story
 * folder: the landing page never imports a story, it lists them over `/api`.
 */
const siblingPackages = ['../../shared', '../../ui', '../protocol'].map(at);

/**
 * Seeds Vite's watcher with the sibling packages, so a *new* file in one of them is seen too
 * (the same plugin as the client's, see `Visualizer/client/vite.config.ts`).
 */
const watchSiblingPackages = () => ({
    name: 'story:watch-sibling-packages',
    configureServer(server: { watcher: { add: (paths: string[]) => void } }) {
        server.watcher.add(siblingPackages);
    },
});

/**
 * The landing page (multiple stories, phase 6). Deliberately a near-copy of the client's config:
 * "one config per app, no shared root config" (§7).
 */
// https://vitejs.dev/config/
export default defineConfig({
    /**
     * The public path the page is served under (`LANDING_BASE`, with both slashes). `/` in dev and
     * behind the production proxy too, where the landing page is the origin's root; every API call
     * is the absolute `/api/…` either way.
     */
    base: process.env.LANDING_BASE || '/',
    // Only the favicon (`stories/example/data/assets/story.png`) is bundled.
    publicDir: false,
    plugins: [react(), watchSiblingPackages()],
    resolve: {
        // Subpaths ahead of their bare package name: a string `find` is a prefix match.
        alias: [
            { find: '@story/ui/index.css', replacement: at('../../ui/src/index.css') },
            { find: '@story/ui', replacement: at('../../ui/src/index.ts') },
            { find: '@story/visualizer-protocol', replacement: at('../protocol/src/index.ts') },
            { find: '@story/shared', replacement: at('../../shared/src/index.ts') },
        ],
    },
    server: {
        host: '0.0.0.0',
        port: 8103,
        strictPort: true,
        fs: {
            // Every internal package is outside `root` (§10 risk 4).
            allow: [repoRoot],
        },
        watch: {
            ignored: ['**/node_modules/**', '**/.git/**', '**/dist/**'],
        },
        /**
         * `Visualizer/server`, same-origin like the client: every call is `/api/...`, and the
         * export download (`/api/stories/<id>/export`) is a plain navigation through this proxy.
         * `VISUALIZER_SERVER` overrides the target.
         *
         * `changeOrigin` stays off, as in the client: `Host` passes through with `Cookie` and
         * `Origin`, so the server's CSRF check (a mutation's `Origin` must match its `Host` or be
         * in `ALLOWED_ORIGINS`) accepts the page under any host name.
         */
        proxy: {
            '/api': {
                target: process.env.VISUALIZER_SERVER ?? 'http://localhost:8123',
            },
        },
    },
});
