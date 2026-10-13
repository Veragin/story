import swc from 'unplugin-swc';
import { defineWorkspace } from 'vitest/config';

// tests never touch the dev database, whatever DB_NAME the shell or container sets
const SERVER_TEST_DB = process.env.DB_TEST_NAME ?? 'story_test';

export default defineWorkspace([
    {
        test: {
            name: 'core',
            root: './clients/shared/core',
            environment: 'node',
            include: ['__tests__/**/*.test.ts'],
            setupFiles: ['./__tests__/setup.ts'],
        },
    },
    {
        test: {
            name: 'data',
            root: './stories/example/data',
            environment: 'node',
            include: ['__tests__/**/*.test.ts'],
        },
    },
    {
        test: {
            name: 'visualizer-server',
            root: './Visualizer/server',
            environment: 'node',
            include: ['__tests__/**/*.test.ts'],
        },
    },
    {
        // esbuild cannot emit decorator metadata, which Nest DI needs (plan R1)
        esbuild: false,
        plugins: [swc.vite({ tsconfigFile: './server/tsconfig.json' })],
        test: {
            name: 'server',
            root: './server',
            environment: 'node',
            include: ['__tests__/**/*.test.ts'],
            setupFiles: ['reflect-metadata'],
            env: { DB_NAME: SERVER_TEST_DB },
        },
    },
    {
        test: {
            name: 'protocol',
            root: './protocol',
            environment: 'node',
            include: ['__tests__/**/*.test.ts'],
        },
    },
    {
        test: {
            name: 'single-engine',
            root: './clients/SingleEngine',
            environment: 'node',
            include: ['vite/__tests__/**/*.test.ts'],
        },
    },
    {
        test: {
            name: 'visualizer-client',
            root: './clients/Visualizer',
            environment: 'jsdom',
            include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
            setupFiles: ['./src/canvas/__tests__/setup.ts'],
        },
    },
    {
        test: {
            name: 'visualizer-landing-page',
            root: './clients/LandingPage',
            environment: 'jsdom',
            include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
            setupFiles: ['./src/__tests__/setup.ts'],
        },
    },
]);
