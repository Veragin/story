import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    { ignores: ['dist', '**/dist/**', 'node_modules'] },
    {
        extends: [js.configs.recommended, ...tseslint.configs.recommended],
        files: ['**/*.{ts,tsx}'],
        languageOptions: {
            ecmaVersion: 2020,
            globals: globals.browser,
            // `require-await` and `no-floating-promises` below are type-aware rules; without
            // this they throw on the first file linted.
            parserOptions: {
                // Vite/vitest configs live outside the app tsconfig's `include`. The project
                // service looks for the *nearest* `tsconfig.json`, so listing these in the
                // root `tsconfig.node.json` (which is what `yarn typecheck` uses) does not
                // make them resolvable here — they need naming explicitly.
                projectService: {
                    allowDefaultProject: ['*.config.ts', '*/*.config.ts', '*/*/*.config.ts', 'vitest.workspace.ts'],
                },
                tsconfigRootDir: import.meta.dirname,
            },
        },
        plugins: {
            'react-hooks': reactHooks,
            'react-refresh': reactRefresh,
        },
        rules: {
            ...reactHooks.configs.recommended.rules,
            'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
            'require-await': 'error',
            '@typescript-eslint/require-await': 'error',
            'no-return-await': 'off',
            'no-throw-literal': 'error',
            '@typescript-eslint/no-floating-promises': ['error'],
        },
    }
);
