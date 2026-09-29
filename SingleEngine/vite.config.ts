import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { storiesPlugin } from './vite/storiesPlugin';

/** Absolute path of `p`, resolved against this config file (i.e. `SingleEngine/`). */
const at = (p: string) => fileURLToPath(new URL(p, import.meta.url));

/** The monorepo root. Everything this app imports lives under it, none of it under `root`. */
const repoRoot = at('..');

/**
 * The folder holding one folder per story: the Visualizer server's `STORIES_ROOT` (same default,
 * `<repo>/stories`, and a relative path is resolved against the repo root the same way), because
 * the server decides who may play a story and this app serves its files.
 */
const storiesRoot = path.resolve(repoRoot, process.env.STORIES_ROOT ?? 'stories');

/** The Visualizer server: the `/api` proxy target and the story guard's access check. */
const visualizerServer = process.env.VISUALIZER_SERVER ?? 'http://localhost:8123';

/**
 * The internal packages this app pulls source out of — all of them siblings, none under `root`.
 * No story folder: `storiesPlugin` watches `STORIES_ROOT` itself.
 */
const siblingPackages = ['../shared', '../ui', '../core'].map(at);

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

/** `ENGINE_ALLOWED_HOSTS` → `server.allowedHosts`: `*` is every host, unset or empty is Vite's default. */
const allowedHostsFromEnv = (value: string | undefined): true | string[] | undefined => {
    const hosts = (value ?? '')
        .split(',')
        .map((h) => h.trim())
        .filter(Boolean);
    if (hosts.includes('*')) return true;
    return hosts.length > 0 ? hosts : undefined;
};

// https://vitejs.dev/config/
export default defineConfig({
    /**
     * The public path the dev server answers under: `/` in dev, `/play/` behind the production
     * proxy (`docker-compose.prod.yml`, `ENGINE_BASE=/play/`, with both slashes; the proxy passes
     * the path through unstripped). Vite serves everything under it — the HMR websocket too
     * (`wss://<host>/play/`), and the `/@fs/`, `/@id/` module URLs become `/play/@fs/…`,
     * `/play/@id/…`, which the story guard reads with the base taken off (`vite/storiesPlugin.ts`).
     * The story's entry URL is built from `import.meta.env.BASE_URL` (`src/worldState.ts`). API
     * calls stay the absolute `/api/…` (`src/storyApi.ts`), the origin's root.
     */
    base: process.env.ENGINE_BASE || '/',
    assetsInclude: ['**/*.png', '**/*.jpg'],
    // No static-serve root: story art lives next to the story (§3) — each image is the `.png`
    // sibling of the passage / character / npc file it belongs to — and the story's virtual
    // module lists its URLs (`vite/storiesPlugin.ts`, read by `src/images.ts`).
    publicDir: false,
    // `storiesPlugin` loads the story picked by `?story=<id>`, resolves `@story/types` /
    // `@story/data` per story, and guards every story file behind the story's access check.
    plugins: [react(), watchSiblingPackages(), storiesPlugin({ storiesRoot, visualizerServer })],
    resolve: {
        /**
         * Explicit source aliases rather than `vite-tsconfig-paths` (§7).
         *
         * Both arrangements resolve; the difference is what they resolve *to*. Left alone,
         * `@story/core` would go through the workspace symlink in `node_modules` and land on
         * the same file — but the aliases state the intent in one place, independently of
         * whether `yarn install` has linked anything, and they keep every internal package on
         * its real source path so an edit in `core/src` is a plain module-graph invalidation
         * and HMR crosses the package boundary.
         *
         * Order matters: `@rollup/plugin-alias` treats a string `find` as a prefix, so a bare
         * `@story/ui` entry would also swallow `@story/ui/index.css` and rewrite it to
         * `ui/src/index.ts/index.css`. Every subpath a package publishes through `exports` is
         * therefore listed ahead of its bare name.
         */
        alias: [
            { find: '@story/ui/index.css', replacement: at('../ui/src/index.css') },
            { find: '@story/ui', replacement: at('../ui/src/index.ts') },

            // No `@story/data` / `@story/types`: they mean a different story per importer, so
            // `storiesPlugin` resolves them (multiple stories, phase 9).
            { find: '@story/core', replacement: at('../core/src/index.ts') },
            { find: '@story/shared', replacement: at('../shared/src/index.ts') },
        ],
    },
    server: {
        host: '0.0.0.0',
        port: 8100,
        strictPort: true,
        /**
         * `ENGINE_ALLOWED_HOSTS`: comma-separated host names the dev server answers besides
         * `localhost` and IP addresses (Vite's DNS-rebinding guard, which also covers the HMR
         * websocket), or `*` for any. Behind the production proxy the `Host` is the public name;
         * `docker-compose.prod.yml` sets `*`, because the port is reachable only through Caddy.
         */
        allowedHosts: allowedHostsFromEnv(process.env.ENGINE_ALLOWED_HOSTS),
        fs: {
            // `root` is `SingleEngine/`, so every sibling package is outside it and would be
            // refused by the dev server's file-serving guard (§10 risk 4).
            // `STORIES_ROOT` may lie outside the repo. Reaching a story file still takes the
            // story's access check (`storiesPlugin`).
            allow: [repoRoot, storiesRoot],
        },
        // The sibling packages are added to this watcher by `watchSiblingPackages` above;
        // `ignored` keeps that from dragging in the workspace symlink farm or build output.
        watch: {
            ignored: ['**/node_modules/**', '**/.git/**', '**/dist/**'],
        },
        /**
         * `Visualizer/server` for the story access check and login (`src/storyApi.ts`), same
         * origin, so the `story_session` cookie is this host's and the story guard sees it on the
         * module requests too. `changeOrigin` stays off, as in the Visualizer client: `Host`
         * passes through with `Cookie` and `Origin`, so the server's CSRF check accepts the login.
         */
        proxy: {
            '/api': { target: visualizerServer },
        },
    },
    esbuild: {
        supported: {
            // `data/register.ts` code-splits the story with dynamic passage imports that the
            // engine awaits at module scope (§7).
            'top-level-await': true,
        },
    },
});
