import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { storiesPlugin } from './vite/storiesPlugin';

const at = (p: string) => fileURLToPath(new URL(p, import.meta.url));

const repoRoot = at('..');

// same default and resolution as the Visualizer server's `STORIES_ROOT`
const storiesRoot = path.resolve(repoRoot, process.env.STORIES_ROOT ?? 'stories');

const visualizerServer = process.env.VISUALIZER_SERVER ?? 'http://localhost:8123';

const siblingPackages = ['../shared', '../ui', '../core'].map(at);

// Vite only watches `root` up front; files outside it are seen lazily, so new ones would be missed.
const watchSiblingPackages = () => ({
    name: 'story:watch-sibling-packages',
    configureServer(server: { watcher: { add: (paths: string[]) => void } }) {
        server.watcher.add(siblingPackages);
    },
});

const allowedHostsFromEnv = (value: string | undefined): true | string[] | undefined => {
    const hosts = (value ?? '')
        .split(',')
        .map((h) => h.trim())
        .filter(Boolean);
    if (hosts.includes('*')) return true;
    return hosts.length > 0 ? hosts : undefined;
};

export default defineConfig({
    base: process.env.ENGINE_BASE || '/',
    assetsInclude: ['**/*.png', '**/*.jpg'],
    publicDir: false,
    plugins: [react(), watchSiblingPackages(), storiesPlugin({ storiesRoot, visualizerServer })],
    resolve: {
        // string `find` is a prefix match: subpaths must precede their bare package name
        alias: [
            { find: '@story/ui/index.css', replacement: at('../ui/src/index.css') },
            { find: '@story/ui', replacement: at('../ui/src/index.ts') },

            // `@story/data` / `@story/types` differ per story: `storiesPlugin` resolves them
            { find: '@story/core', replacement: at('../core/src/index.ts') },
            { find: '@story/shared', replacement: at('../shared/src/index.ts') },
        ],
    },
    server: {
        host: '0.0.0.0',
        port: 8100,
        strictPort: true,
        allowedHosts: allowedHostsFromEnv(process.env.ENGINE_ALLOWED_HOSTS),
        fs: {
            allow: [repoRoot, storiesRoot],
        },
        watch: {
            ignored: ['**/node_modules/**', '**/.git/**', '**/dist/**'],
        },
        // same origin so the `story_session` cookie reaches the story guard; Host passes through for CSRF
        proxy: {
            '/api': { target: visualizerServer },
        },
    },
    esbuild: {
        supported: {
            'top-level-await': true,
        },
    },
});
