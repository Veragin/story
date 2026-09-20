import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import viteTsconfigPaths from 'vite-tsconfig-paths';

// https://vitejs.dev/config/
export default defineConfig({
    assetsInclude: ['**/*.png', '**/*.jpg'],
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
