import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const at = (p: string) => fileURLToPath(new URL(p, import.meta.url));

const REPO_ROOT = at('../..');

// no `data/` or `types/`: stories are fetched at run time through the play API (`@story/story-loader`)
const SIBLING_PACKAGES = [
    '../shared/utils',
    '../shared/ui',
    '../shared/core',
    '../shared/storyLoader',
    '../../protocol',
].map(at);

// Vite watches outside `root` only lazily, so new files in sibling packages would go unseen
const watchSiblingPackages = () => ({
    name: 'story:watch-sibling-packages',
    configureServer(server: { watcher: { add: (paths: string[]) => void } }) {
        server.watcher.add(SIBLING_PACKAGES);
    },
});

export default defineConfig({
    // `/play/` in production; API calls are absolute `/api/…`
    base: process.env.PLAYER_BASE || '/',
    publicDir: false,
    plugins: [react(), watchSiblingPackages()],
    resolve: {
        // a string `find` is a prefix match, so each subpath must precede its bare package name
        alias: [
            { find: '@story/ui/index.css', replacement: at('../shared/ui/src/index.css') },
            { find: '@story/ui', replacement: at('../shared/ui/src/index.ts') },

            // no `@story/data` / `@story/types`: type-only imports, the story itself comes through the loader

            { find: '@story/core', replacement: at('../shared/core/src/index.ts') },
            { find: '@story/story-loader', replacement: at('../shared/storyLoader/src/index.ts') },
            { find: '@story/protocol', replacement: at('../../protocol/src/index.ts') },
            { find: '@story/shared', replacement: at('../shared/utils/src/index.ts') },
        ],
    },
    server: {
        host: '0.0.0.0',
        port: 8100,
        strictPort: true,
        fs: {
            // every internal package lives outside `root`
            allow: [REPO_ROOT],
        },
        watch: {
            ignored: ['**/node_modules/**', '**/.git/**', '**/dist/**'],
        },
        // same origin so the session cookie reaches the play API; no `changeOrigin`: CSRF checks `Origin` against `Host`.
        // The header limits the API to the player's routes, as the production play site does (docker/Caddyfile).
        proxy: {
            '/api': {
                target: process.env.STORY_SERVER ?? 'http://localhost:8123',
                headers: { 'x-story-play-site': '1' },
            },
        },
    },
});
