import js from '@eslint/js';
import globals from 'globals';
import importPlugin from 'eslint-plugin-import';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

// shared → types → { ui, core } → data → services. `types ⇄ data` and `core → data` are allowed
// here because they are type-only (the latter enforced by `no-restricted-imports` below).
const SERVICES = ['SingleEngine', 'Visualizer', 'MultiEngine'];

// globs only: a zone mixing globs and plain paths flags every import in its target
const tree = (dir) => `./${dir}/**`;

const zone = (target, from, message) => ({ target, from, message });

const PACKAGE_DIRS = {
    types: 'stories/*/types',
    data: 'stories/*/data',
    shared: 'shared',
    ui: 'ui',
    core: 'core',
};
const pkg = (name) => tree(PACKAGE_DIRS[name]);

const packagesExcept = (...allowed) =>
    Object.keys(PACKAGE_DIRS)
        .filter((p) => !allowed.includes(p))
        .map(pkg);

const services = (list = SERVICES) => list.map(tree);

const boundaryZones = [
    zone(
        pkg('shared'),
        packagesExcept('shared'),
        'shared/ is the bottom of the layering and may not import any other @story package.'
    ),

    zone(
        pkg('types'),
        packagesExcept('shared', 'data', 'types'),
        'types/ may import only @story/shared (and @story/data type-only).'
    ),

    zone(
        pkg('ui'),
        packagesExcept('shared', 'types', 'ui'),
        'ui/ may import only @story/shared and @story/types — it must not reach into the runtime (core) or the story (data).'
    ),

    zone(
        pkg('core'),
        packagesExcept('shared', 'types', 'data', 'core'),
        'core/ is headless and may not import @story/ui.'
    ),

    zone(pkg('data'), packagesExcept('shared', 'types', 'core', 'data'), 'data/ may not import @story/ui.'),

    zone(
        pkg('types'),
        services(),
        'types/ is author-edited and must never import from a service (SingleEngine, Visualizer, MultiEngine).'
    ),
    zone(
        pkg('data'),
        services(),
        'data/ is author-edited and must never import from a service (SingleEngine, Visualizer, MultiEngine).'
    ),

    ...['shared', 'ui', 'core'].map((p) =>
        zone(
            pkg(p),
            services(),
            `${p}/ is a shared package and may not import from a service — the dependency arrow points the other way.`
        )
    ),

    ...SERVICES.flatMap((target) =>
        SERVICES.filter((s) => s !== target).map((other) =>
            zone(
                tree(target),
                tree(other),
                `${target}/ must not import from ${other}/ — no service may depend on another service. Extract the shared piece into a package.`
            )
        )
    ),

    zone(
        tree('Visualizer/protocol'),
        services([
            ...SERVICES.filter((s) => s !== 'Visualizer'),
            'Visualizer/client',
            'Visualizer/server',
            'Visualizer/landing-page',
        ]),
        'Visualizer/protocol is the client/server contract and may not import any service code.'
    ),
    zone(
        tree('Visualizer/protocol'),
        packagesExcept('shared', 'types'),
        'Visualizer/protocol may import only @story/shared (and @story/types, type-only).'
    ),
    zone(
        tree('Visualizer/client'),
        tree('Visualizer/server'),
        'Visualizer/client must not import Visualizer/server — share it through @story/visualizer-protocol.'
    ),
    zone(
        tree('Visualizer/server'),
        tree('Visualizer/client'),
        'Visualizer/server must not import Visualizer/client — share it through @story/visualizer-protocol.'
    ),
    zone(
        tree('Visualizer/landing-page'),
        [tree('Visualizer/client'), tree('Visualizer/server'), pkg('data'), pkg('types'), pkg('core')],
        'Visualizer/landing-page may import only @story/visualizer-protocol, @story/ui and @story/shared — it talks to the server over HTTP and never imports a story or another Visualizer app.'
    ),
    zone(
        [tree('Visualizer/client'), tree('Visualizer/server')],
        tree('Visualizer/landing-page'),
        'Nothing imports Visualizer/landing-page: it is an app. Move what both need into a package.'
    ),
    // the server reads the story as source text; importing it would run it
    zone(
        tree('Visualizer/server'),
        [pkg('data'), pkg('core'), pkg('ui')],
        'Visualizer/server reads data/ as source and must not import @story/data, @story/core or @story/ui.'
    ),
];

// the template lies under the server but is a story, so it gets a story's zones
const TEMPLATE = 'Visualizer/server/template';
const templateZones = [
    zone(
        tree(TEMPLATE),
        [
            pkg('ui'),
            tree('stories'),
            ...services(SERVICES.filter((s) => s !== 'Visualizer')),
            ...['client', 'protocol', 'landing-page', 'server/src', 'server/__tests__'].map((p) =>
                tree(`Visualizer/${p}`)
            ),
        ],
        'The story template is a story: it may import only @story/shared, @story/core and its own types/ and data/ — no @story/ui, no service, no other story.'
    ),
];

export default tseslint.config(
    { ignores: ['dist', '**/dist/**', 'node_modules'] },
    {
        // the typescript resolver maps `@story/*` to source paths so the repo-relative zones match
        files: ['**/*.{ts,tsx}'],
        plugins: { import: importPlugin },
        settings: {
            'import/resolver': {
                typescript: { project: './tsconfig.json' },
            },
        },
        rules: {
            'import/no-restricted-paths': ['error', { basePath: import.meta.dirname, zones: boundaryZones }],
        },
    },
    {
        extends: [js.configs.recommended, ...tseslint.configs.recommended],
        files: ['**/*.{ts,tsx}'],
        languageOptions: {
            ecmaVersion: 2020,
            globals: globals.browser,
            parserOptions: {
                // configs are outside every tsconfig's `include`
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
    },
    {
        // a runtime story import would pull `data/` into Vite's graph and full-reload on every edit
        files: ['Visualizer/client/**/*.{ts,tsx}'],
        rules: {
            '@typescript-eslint/no-restricted-imports': [
                'error',
                {
                    paths: ['@story/data', '@story/core'].map((name) => ({
                        name,
                        allowTypeImports: true,
                        message: `Visualizer/client must not import ${name} at runtime — load story data through src/api. \`import type\` is fine.`,
                    })),
                    patterns: [
                        {
                            group: ['@story/data/*', '@story/core/*'],
                            allowTypeImports: true,
                            message:
                                'Visualizer/client must not import the story at runtime — load it through src/api. `import type` is fine.',
                        },
                    ],
                },
            ],
        },
    },
    {
        files: ['SingleEngine/src/**/*.{ts,tsx}'],
        rules: {
            '@typescript-eslint/no-restricted-imports': [
                'error',
                {
                    paths: ['@story/data', '@story/types'].map((name) => ({
                        name,
                        allowTypeImports: true,
                        message: `SingleEngine/src must not import ${name} at runtime — the story is loaded by \`loadStory\` and reached through the engine (\`engine.storyModule\`). \`import type\` is fine.`,
                    })),
                    patterns: [
                        {
                            group: ['@story/data/*', '@story/types/*'],
                            allowTypeImports: true,
                            message:
                                'SingleEngine/src must not import the story at runtime — it is loaded by `loadStory`. `import type` is fine.',
                        },
                    ],
                },
            ],
        },
    },
    {
        files: ['core/src/**/*.ts'],
        rules: {
            '@typescript-eslint/no-restricted-imports': [
                'error',
                {
                    paths: [
                        {
                            name: '@story/data',
                            allowTypeImports: true,
                            message:
                                'core/src must not import @story/data at runtime — read the story through `engine.storyModule` (TStoryModule). `import type` is fine.',
                        },
                    ],
                    patterns: [
                        {
                            group: ['@story/data/*'],
                            allowTypeImports: true,
                            message:
                                'core/src must not import the story at runtime — read it through `engine.storyModule` (TStoryModule). `import type` is fine.',
                        },
                    ],
                },
            ],
        },
    },
    {
        // `{}` data types: the server generates `export type T<Id>Data = {}`
        files: [`${TEMPLATE}/**/*.ts`],
        settings: {
            'import/resolver': {
                typescript: { project: `./${TEMPLATE}/tsconfig.json` },
            },
        },
        rules: {
            'import/no-restricted-paths': ['error', { basePath: import.meta.dirname, zones: templateZones }],
            '@typescript-eslint/no-empty-object-type': 'off',
        },
    }
);
