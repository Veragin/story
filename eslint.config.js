import js from '@eslint/js';
import globals from 'globals';
import importPlugin from 'eslint-plugin-import';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

// shared → types → { ui, core } → data → services. `types ⇄ data` and `core → data` are allowed
// here because they are type-only (the latter enforced by `no-restricted-imports` below).
const SERVER = 'server';
const PROTOCOL = 'protocol';
const SERVICES = ['clients/SinglePlayer', 'clients/Visualizer', 'clients/LandingPage', 'clients/MultiEngine', SERVER];

// globs only: a zone mixing globs and plain paths flags every import in its target
const tree = (dir) => `./${dir}/**`;

const zone = (target, from, message) => ({ target, from, message });

const PACKAGE_DIRS = {
    types: 'stories/*/types',
    data: 'stories/*/data',
    shared: 'clients/shared/utils',
    ui: 'clients/shared/ui',
    core: 'clients/shared/core',
    storyLoader: 'clients/shared/storyLoader',
};
const pkg = (name) => tree(PACKAGE_DIRS[name]);

const packagesExcept = (...allowed) =>
    Object.keys(PACKAGE_DIRS)
        .filter((p) => !allowed.includes(p))
        .map(pkg);

const services = (list = SERVICES) => list.map(tree);
const servicesAndProtocol = () => [...services(), tree(PROTOCOL)];

const boundaryZones = [
    zone(
        pkg('shared'),
        packagesExcept('shared'),
        '@story/shared is the bottom of the layering and may not import any other @story package.'
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

    // its tests run the example story, so they hand it @story/core as a host module
    zone(
        pkg('storyLoader'),
        packagesExcept('shared', 'core', 'storyLoader'),
        '@story/story-loader may import only @story/shared (the story reaches the rest through its host modules).'
    ),

    zone(
        pkg('types'),
        servicesAndProtocol(),
        'types/ is author-edited and must never import from a service (the clients, the server) or the protocol.'
    ),
    zone(
        pkg('data'),
        servicesAndProtocol(),
        'data/ is author-edited and must never import from a service (the clients, the server) or the protocol.'
    ),

    ...['shared', 'ui', 'core', 'storyLoader'].map((p) =>
        zone(
            pkg(p),
            servicesAndProtocol(),
            `@story/${p} is a shared package and may not import from a service or the protocol — the dependency arrow points the other way.`
        )
    ),

    ...SERVICES.flatMap((target) =>
        SERVICES.filter((s) => s !== target).map((other) =>
            zone(
                tree(target),
                tree(other),
                `${target}/ must not import from ${other}/ — no service may depend on another service. Share it through @story/protocol or a package.`
            )
        )
    ),

    zone(tree(PROTOCOL), services(), 'protocol/ is the client/server contract and may not import any service code.'),
    zone(
        tree(PROTOCOL),
        packagesExcept('shared', 'types'),
        'protocol/ may import only @story/shared (and @story/types, type-only).'
    ),
    zone(
        tree('clients/LandingPage'),
        [pkg('data'), pkg('types'), pkg('core')],
        'clients/LandingPage may import only @story/protocol, @story/ui and @story/shared — it talks to the server over HTTP and never imports a story.'
    ),
    // the server reads the story as source text; importing it would run it
    zone(
        tree(SERVER),
        [pkg('data'), pkg('core'), pkg('ui')],
        `${SERVER} reads data/ as source and must not import @story/data, @story/core or @story/ui.`
    ),
];

// the template lies under the server but is a story, so it gets a story's zones
const templateZones = [
    zone(
        tree(`${SERVER}/template`),
        [
            pkg('ui'),
            tree('stories'),
            tree(PROTOCOL),
            ...services(SERVICES.filter((s) => s !== SERVER)),
            ...['src', '__tests__'].map((p) => tree(`${SERVER}/${p}`)),
        ],
        'The story template is a story: it may import only @story/shared, @story/core and its own types/ and data/ — no @story/ui, no service, no other story.'
    ),
];

export default tseslint.config(
    { ignores: ['dist', '**/dist/**', '**/dist-standalone/**', 'node_modules'] },
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
        files: ['clients/Visualizer/**/*.{ts,tsx}'],
        rules: {
            '@typescript-eslint/no-restricted-imports': [
                'error',
                {
                    paths: ['@story/data', '@story/core'].map((name) => ({
                        name,
                        allowTypeImports: true,
                        message: `clients/Visualizer must not import ${name} at runtime — load story data through src/api. \`import type\` is fine.`,
                    })),
                    patterns: [
                        {
                            group: ['@story/data/*', '@story/core/*'],
                            allowTypeImports: true,
                            message:
                                'clients/Visualizer must not import the story at runtime — load it through src/api. `import type` is fine.',
                        },
                    ],
                },
            ],
        },
    },
    {
        files: ['clients/SinglePlayer/src/**/*.{ts,tsx}'],
        rules: {
            '@typescript-eslint/no-restricted-imports': [
                'error',
                {
                    paths: ['@story/data', '@story/types'].map((name) => ({
                        name,
                        allowTypeImports: true,
                        message: `SinglePlayer/src must not import ${name} at runtime — the story is loaded by \`loadStory\` and reached through the engine (\`engine.storyModule\`). \`import type\` is fine.`,
                    })),
                    patterns: [
                        {
                            group: ['@story/data/*', '@story/types/*'],
                            allowTypeImports: true,
                            message:
                                'SinglePlayer/src must not import the story at runtime — it is loaded by `loadStory`. `import type` is fine.',
                        },
                    ],
                },
            ],
        },
    },
    {
        files: ['clients/shared/core/src/**/*.ts'],
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
        files: [`${SERVER}/template/**/*.ts`],
        settings: {
            'import/resolver': {
                typescript: { project: `./${SERVER}/template/tsconfig.json` },
            },
        },
        rules: {
            'import/no-restricted-paths': ['error', { basePath: import.meta.dirname, zones: templateZones }],
        },
    },
    {
        // `{}` data types: the server generates `export type T<Id>Data = {}` into every story
        files: [`${SERVER}/template/**/*.ts`, `${PACKAGE_DIRS.data}/**/*.ts`],
        rules: {
            '@typescript-eslint/no-empty-object-type': 'off',
        },
    }
);
