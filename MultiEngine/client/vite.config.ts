import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const at = (p: string) => fileURLToPath(new URL(p, import.meta.url));

const repoRoot = at('../..');

const storyDir = '../../stories/example';

const siblingPackages = [`${storyDir}/types`, `${storyDir}/data`, '../../shared', '../../ui', '../../core'].map(at);

// Vite only watches `root` up front; files outside it are seen lazily, so new ones would be missed.
const watchSiblingPackages = () => ({
    name: 'story:watch-sibling-packages',
    configureServer(server: { watcher: { add: (paths: string[]) => void } }) {
        server.watcher.add(siblingPackages);
    },
});

export default defineConfig({
    assetsInclude: ['**/*.png', '**/*.jpg'],
    publicDir: false,
    plugins: [react(), watchSiblingPackages()],
    resolve: {
        // string `find` is a prefix match: subpaths must precede their bare package name
        alias: [
            { find: '@story/ui/index.css', replacement: at('../../ui/src/index.css') },
            { find: '@story/ui', replacement: at('../../ui/src/index.ts') },

            { find: /^@story\/data\/(.+)$/, replacement: at(`${storyDir}/data/`) + '$1' },
            { find: '@story/data', replacement: at(`${storyDir}/data/index.ts`) },

            { find: '@story/core', replacement: at('../../core/src/index.ts') },
            { find: '@story/types', replacement: at(`${storyDir}/types/index.ts`) },
            { find: '@story/shared', replacement: at('../../shared/src/index.ts') },
        ],
    },
    server: {
        host: '0.0.0.0',
        port: 8102,
        strictPort: true,
        fs: {
            allow: [repoRoot],
        },
        watch: {
            ignored: ['**/node_modules/**', '**/.git/**', '**/dist/**'],
        },
    },
    esbuild: {
        supported: {
            'top-level-await': true,
        },
    },
});
