import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const at = (p: string) => fileURLToPath(new URL(p, import.meta.url));

const REPO_ROOT = at('../..');

// no `data/` or `core/`: the story comes over `/api`, and watching it would reload the page on every story edit
const SIBLING_PACKAGES = ['../../stories/example/types', '../../shared', '../../ui', '../protocol'].map(at);

// Vite watches outside `root` only lazily, so new files in sibling packages would go unseen
const watchSiblingPackages = () => ({
    name: 'story:watch-sibling-packages',
    configureServer(server: { watcher: { add: (paths: string[]) => void } }) {
        server.watcher.add(SIBLING_PACKAGES);
    },
});

export default defineConfig({
    // only asset URLs move: routing is the hash and API calls are absolute `/api/…`
    base: process.env.VISUALIZER_BASE || '/',
    assetsInclude: ['**/*.png', '**/*.jpg'],
    // story art is served by the server's `/api/stories/<id>/images/…`, not bundled
    publicDir: false,
    plugins: [react(), watchSiblingPackages()],
    resolve: {
        // a string `find` is a prefix match, so each subpath must precede its bare package name
        alias: [
            { find: '@story/ui/index.css', replacement: at('../../ui/src/index.css') },
            { find: '@story/ui', replacement: at('../../ui/src/index.ts') },

            // no `@story/data` / `@story/core`: type-only imports, never resolved at runtime

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
            // every internal package lives outside `root`
            allow: [REPO_ROOT],
        },
        watch: {
            ignored: ['**/node_modules/**', '**/.git/**', '**/dist/**'],
        },
        // no `changeOrigin`: the server's CSRF check needs `Origin` to match the forwarded `Host`
        proxy: {
            '/api': {
                target: process.env.VISUALIZER_SERVER ?? 'http://localhost:8123',
            },
        },
    },
});
