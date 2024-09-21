import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import viteTsconfigPaths from 'vite-tsconfig-paths';

// https://vitejs.dev/config/
export default defineConfig({
    assetsInclude: ['**/*.png', '**/*.jpg'],
    plugins: [react(), viteTsconfigPaths()],
    server: {
        host: '0.0.0.0',
        port: 3000,
        strictPort: true,
        hmr: {
            path: `ws`,
        },
    },
});
