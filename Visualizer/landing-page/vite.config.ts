import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const at = (p: string) => fileURLToPath(new URL(p, import.meta.url));

const repoRoot = at('../..');

const siblingPackages = ['../../shared', '../../ui', '../protocol'].map(at);

// so a *new* file in a sibling package is seen too
const watchSiblingPackages = () => ({
    name: 'story:watch-sibling-packages',
    configureServer(server: { watcher: { add: (paths: string[]) => void } }) {
        server.watcher.add(siblingPackages);
    },
});

// deliberately a near-copy of the client's config: one config per app
export default defineConfig({
    base: process.env.LANDING_BASE || '/',
    publicDir: false,
    plugins: [react(), watchSiblingPackages()],
    resolve: {
        // subpaths first: a string `find` is a prefix match
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
            // every internal package is outside `root`
            allow: [repoRoot],
        },
        watch: {
            ignored: ['**/node_modules/**', '**/.git/**', '**/dist/**'],
        },
        // no `changeOrigin`: the server's CSRF check needs the original `Host` to match `Origin`
        proxy: {
            '/api': {
                target: process.env.VISUALIZER_SERVER ?? 'http://localhost:8123',
            },
        },
    },
});
