import { defineWorkspace } from 'vitest/config';

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
