import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
    {
        test: {
            name: 'core',
            root: './core',
            environment: 'node',
            include: ['test/**/*.test.ts'],
            setupFiles: ['./test/setup.ts'],
        },
    },
    {
        test: {
            name: 'data',
            root: './stories/example/data',
            environment: 'node',
            include: ['test/**/*.test.ts'],
        },
    },
    {
        test: {
            name: 'visualizer-server',
            root: './Visualizer/server',
            environment: 'node',
            include: ['test/**/*.test.ts'],
        },
    },
    {
        test: {
            name: 'single-engine',
            root: './SingleEngine',
            environment: 'node',
            include: ['vite/test/**/*.test.ts'],
        },
    },
    {
        test: {
            name: 'visualizer-client',
            root: './Visualizer/client',
            environment: 'jsdom',
            include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
            setupFiles: ['./src/canvas/test/setup.ts'],
        },
    },
    {
        test: {
            name: 'visualizer-landing-page',
            root: './Visualizer/landing-page',
            environment: 'jsdom',
            include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
            setupFiles: ['./src/test/setup.ts'],
        },
    },
]);
