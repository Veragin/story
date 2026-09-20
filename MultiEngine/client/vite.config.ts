import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/** Absolute path of `p`, resolved against this config file (i.e. `MultiEngine/client/`). */
const at = (p: string) => fileURLToPath(new URL(p, import.meta.url));

/** The monorepo root. Everything this app imports lives under it, none of it under `root`. */
const repoRoot = at('../..');

/** The internal packages this app pulls source out of — all of them outside `root`. */
const siblingPackages = ['../../types', '../../data', '../../shared', '../../ui', '../../core'].map(at);

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
 * Deliberately near-identical to `SingleEngine/vite.config.ts` and
 * `Visualizer/client/vite.config.ts`: §7 is "one config per app, no shared root config", so the
 * duplication is the intent — each app states its own edges and can diverge (ports, and for this
 * app the `/api` + ws proxy to `MultiEngine/server` on :8124) without a shared file turning into
 * a second place to reason about.
 *
 * The alias list is the full one rather than only the packages `src/main.tsx` imports today. The
 * app is a scaffold (§10 risk 5) and will grow into the story runtime; trimming the list now
 * would only mean re-deriving it later, and an unused alias costs nothing at build time — unlike
 * an unused *dependency*, which `package.json` therefore does not carry.
 */
// https://vitejs.dev/config/
export default defineConfig({
    assetsInclude: ['**/*.png', '**/*.jpg'],
    // No static-serve root: story art lives in `data/assets/` (§3) and is pulled in through the
    // bundler by `data/assets/index.ts`, so it gets hashed and validated at build time instead
    // of being copied verbatim.
    publicDir: false,
    plugins: [react(), watchSiblingPackages()],
    resolve: {
        /**
         * Order matters: `@rollup/plugin-alias` treats a string `find` as a prefix, so a bare
         * `@story/ui` entry would also swallow `@story/ui/index.css` and rewrite it to
         * `ui/src/index.ts/index.css`. Every subpath a package publishes through `exports` is
         * therefore listed ahead of its bare name.
         */
        alias: [
            { find: '@story/ui/index.css', replacement: at('../../ui/src/index.css') },
            { find: '@story/ui', replacement: at('../../ui/src/index.ts') },

            // `@story/data` publishes `"./*"`: the author's tree is the public surface (§5),
            // so deep paths resolve by pattern instead of an enumerated list that would go
            // stale every time the story grows a folder.
            { find: /^@story\/data\/assets$/, replacement: at('../../data/assets/index.ts') },
            { find: /^@story\/data\/(.+)$/, replacement: at('../../data/') + '$1' },
            { find: '@story/data', replacement: at('../../data/index.ts') },

            { find: '@story/core', replacement: at('../../core/src/index.ts') },
            { find: '@story/types', replacement: at('../../types/index.ts') },
            { find: '@story/shared', replacement: at('../../shared/src/index.ts') },
        ],
    },
    server: {
        host: '0.0.0.0',
        port: 8102,
        strictPort: true,
        fs: {
            // `root` is `MultiEngine/client/`, so every internal package is outside it and would
            // be refused by the dev server's file-serving guard (§10 risk 4).
            allow: [repoRoot],
        },
        // The sibling packages are added to this watcher by `watchSiblingPackages` above;
        // `ignored` keeps that from dragging in the workspace symlink farm or build output.
        watch: {
            ignored: ['**/node_modules/**', '**/.git/**', '**/dist/**'],
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
