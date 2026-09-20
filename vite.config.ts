import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import viteTsconfigPaths from 'vite-tsconfig-paths';

/**
 * The Visualizer's config, until Phase 8 gives it a workspace of its own on :8101.
 *
 * As of Phase 7 this serves exactly one entry: `index.html` left with SingleEngine, so the
 * default `index.html` build input no longer exists and has to be named explicitly below.
 * `vite-tsconfig-paths` stays *here* and only here — the Visualizer still imports itself
 * through the legacy `code/Visualizer/*` alias in the root `tsconfig.json`, which is precisely
 * the "intra-package aliases" case §7 keeps the plugin for. SingleEngine, now free of legacy
 * paths, declares its `@story/*` edges as explicit `resolve.alias` entries instead.
 */
// https://vitejs.dev/config/
export default defineConfig({
    assetsInclude: ['**/*.png', '**/*.jpg'],
    build: {
        rollupOptions: {
            input: 'visualizer.html',
        },
    },
    // No static-serve root: story art moved out of `public/` into `data/assets/` (§3) and is
    // pulled in through the bundler by `data/assets/index.ts`, so it gets hashed and validated
    // at build time instead of being copied verbatim.
    publicDir: false,
    plugins: [react(), viteTsconfigPaths()],
    server: {
        host: '0.0.0.0',
        port: 3000,
        strictPort: true,
        hmr: {
            path: `ws`,
        },
    },
    esbuild: {
        supported: {
            'top-level-await': true
        },
    }
});
