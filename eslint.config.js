import js from '@eslint/js';
import globals from 'globals';
import importPlugin from 'eslint-plugin-import';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

/**
 * The layering of REFACTOR_PLAN §2, as confirmed by the author and as the code actually is.
 * §2 as written has `types → shared`; it is inverted here (see "Outcome / deviations").
 *
 *   shared    →  nothing
 *   types     →  shared            (+ data, type-only — accepted cycle, see below)
 *   ui        →  shared, types
 *   core      →  shared, types, data (type-only in src/; the tests play the example story)
 *   data      →  shared, types, core
 *   services  →  any package, but never another service
 *
 * Two documented exceptions this rule deliberately does NOT flag:
 *
 *  1. `types ⇄ data` is an accepted **type-only** cycle. `types/{ids,TChapter,TCharacter,
 *     TLocation,TItem}.ts` derive their id unions from the author's actual data,
 *     which is the point of §2.1 — the two author-edited folders are one surface. Every one
 *     of those imports is an `import type`, so it vanishes at runtime.
 *  2. **`core → data` is type-only in `core/src/`.** The engine gets the story injected
 *     (`createWorldState(register, itemInfo, storyId)` → `engine.storyModule`), so it can run
 *     any story; see the top of `core/src/index.ts`. Path zones cannot tell `import type`
 *     from a value import, so the zone below allows `core → data` and a separate
 *     `no-restricted-imports` block at the bottom of this file forbids the value half.
 *     `core/test/` may import the story at value level: the tests play the example.
 *
 * The hard invariant §7 actually asks for — and the one that keeps a per-story fork
 * mergeable (§2.1) — is the last two zones: **nothing in `types/` or `data/` may import from
 * a service.** Author edits land in those two folders, engine changes everywhere else; a
 * single import across that line makes the next engine upgrade a manual merge.
 *
 * Multiple stories (phase 2): the author's two folders are per story now,
 * `stories/<id>/types` and `stories/<id>/data`, so their zones are globs over every story.
 */
const SERVICES = ['SingleEngine', 'Visualizer', 'MultiEngine'];

/**
 * Every file under a repo-relative directory, as an `import/no-restricted-paths` glob.
 *
 * Every zone path is a glob, not a plain directory, and that is load-bearing: the rule matches a
 * glob against the whole file path (so the bare story directory glob would match no file, hence
 * the trailing `/**`), and a zone whose `from` mixes globs with plain paths is rejected outright — the rule
 * then flags *every* import in the target. The story folders have to be globs, so everything is.
 */
const tree = (dir) => `./${dir}/**`;

/** `import/no-restricted-paths` zone: `target` may not import from `from`. */
const zone = (target, from, message) => ({ target, from, message });

/** Where each package lives. `types` and `data` exist once per story (`stories/<id>/`). */
const PACKAGE_DIRS = {
    types: 'stories/*/types',
    data: 'stories/*/data',
    shared: 'shared',
    ui: 'ui',
    core: 'core',
};
const pkg = (name) => tree(PACKAGE_DIRS[name]);

/** Every package directory except the ones listed — used to express "may import only X". */
const packagesExcept = (...allowed) =>
    Object.keys(PACKAGE_DIRS)
        .filter((p) => !allowed.includes(p))
        .map(pkg);

/** Every service directory, as globs. */
const services = (list = SERVICES) => list.map(tree);

const boundaryZones = [
    /* shared is the floor: it may import nothing else internal. `parsePassageId` moved to
       `core` rather than `shared` precisely because it was shared's only edge back to types. */
    zone(
        pkg('shared'),
        packagesExcept('shared'),
        'shared/ is the bottom of the layering and may not import any other @story package.'
    ),

    /* types may import shared, and data type-only (the accepted cycle above). */
    zone(
        pkg('types'),
        packagesExcept('shared', 'data', 'types'),
        'types/ may import only @story/shared (and @story/data type-only).'
    ),

    /* ui is React-land and headless-runtime-free: no core, no data. */
    zone(
        pkg('ui'),
        packagesExcept('shared', 'types', 'ui'),
        'ui/ may import only @story/shared and @story/types — it must not reach into the runtime (core) or the story (data).'
    ),

    /* core is headless: no ui. core → data is legal here; it is type-only in src/ (see the
       `no-restricted-imports` block at the bottom). */
    zone(
        pkg('core'),
        packagesExcept('shared', 'types', 'data', 'core'),
        'core/ is headless and may not import @story/ui.'
    ),

    /* data is the author's tree: no ui either — translations and showToast live in shared
       for exactly this reason (see "Outcome / deviations" #3). */
    zone(pkg('data'), packagesExcept('shared', 'types', 'core', 'data'), 'data/ may not import @story/ui.'),

    /* THE §7 RULE. Anything under a service directory is off limits to the author's folders. */
    zone(
        pkg('types'),
        services(),
        'types/ is author-edited and must never import from a service (SingleEngine, Visualizer, MultiEngine) — REFACTOR_PLAN §2.1, §7.'
    ),
    zone(
        pkg('data'),
        services(),
        'data/ is author-edited and must never import from a service (SingleEngine, Visualizer, MultiEngine) — REFACTOR_PLAN §2.1, §7.'
    ),

    /* …and the packages below the services may not reach up into them either. */
    ...['shared', 'ui', 'core'].map((p) =>
        zone(
            pkg(p),
            services(),
            `${p}/ is a shared package and may not import from a service — the dependency arrow points the other way.`
        )
    ),

    /* No service may import another service. Each is its own deployable; anything two of them
       need belongs in a package. (SingleEngine's passage templates are the live example —
       §3 defers extracting them to `ui/` until MultiEngine is actually built.) */
    ...SERVICES.flatMap((target) =>
        SERVICES.filter((s) => s !== target).map((other) =>
            zone(
                tree(target),
                tree(other),
                `${target}/ must not import from ${other}/ — no service may depend on another service. Extract the shared piece into a package.`
            )
        )
    ),

    /* The Visualizer is one service in three workspaces (plan §1.1, WP1). `protocol` is the wire
       contract both halves import, so it must stay importable from a browser *and* from node: it
       may import only @story/shared (and @story/types), never a service — its own siblings
       included — nor the runtime, the story or the UI. */
    zone(
        tree('Visualizer/protocol'),
        services([
            ...SERVICES.filter((s) => s !== 'Visualizer'),
            'Visualizer/client',
            'Visualizer/server',
            'Visualizer/landing-page',
        ]),
        'Visualizer/protocol is the client/server contract and may not import any service code (plan WP1).'
    ),
    zone(
        tree('Visualizer/protocol'),
        packagesExcept('shared', 'types'),
        'Visualizer/protocol may import only @story/shared (and @story/types, type-only) — plan §1.1.'
    ),
    /* The two halves talk over HTTP only; what they share lives in `protocol`. */
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
    /* The landing page (multiple stories, phase 6) is a third front-end of the same service: it
       talks to the server over HTTP like the client, and shares nothing with the client but
       packages (`@story/ui`, the protocol). It never touches a story either: it lists them. */
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
    /* The server reads the story as *source text* (ts-morph); importing it would run it. */
    zone(
        tree('Visualizer/server'),
        [pkg('data'), pkg('core'), pkg('ui')],
        'Visualizer/server reads data/ as source and must not import @story/data, @story/core or @story/ui (plan §1.1).'
    ),
];

/**
 * The story template (`Visualizer/server/template/`, multiple stories phase 5) lies inside the
 * server's folder but is not server code: it is a story, copied into `stories/<id>/` on "create
 * story" and never imported by the server. It gets a story's zones instead of the server's (see
 * the template block at the bottom): no `@story/ui`, no service (the rest of the Visualizer
 * included) and no other story.
 */
const TEMPLATE = 'Visualizer/server/template';
const templateZones = [
    zone(
        tree(TEMPLATE),
        [
            pkg('ui'),
            tree('stories'),
            ...services(SERVICES.filter((s) => s !== 'Visualizer')),
            ...['client', 'protocol', 'landing-page', 'server/src', 'server/test'].map((p) => tree(`Visualizer/${p}`)),
        ],
        'The story template is a story: it may import only @story/shared, @story/core and its own types/ and data/ — no @story/ui, no service, no other story.'
    ),
];

export default tseslint.config(
    { ignores: ['dist', '**/dist/**', 'node_modules'] },
    {
        /**
         * Layering enforcement (REFACTOR_PLAN §7). Separate from the block below so the
         * boundary rule keeps applying even if the main block's `files`/`extends` change,
         * and so the whole layering reads in one place.
         *
         * `import/no-restricted-paths` works on resolved file paths, so the specifier
         * `@story/core` has to become `core/src/index.ts` before the zones can see it. That
         * is what the typescript resolver is for: it reads the `paths` in the root
         * `tsconfig.json`, which already map every `@story/*` to its source. Without it the
         * node resolver would follow the `node_modules/@story/*` workspace symlink and the
         * zone globs — which are repo-relative — would never match.
         */
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
    },
    {
        /**
         * Live refresh, point 1 (Visualizer plan §3): the Visualizer client never *runs* the story.
         * The server is its only source of story data; a runtime import of `@story/data` or
         * `@story/core` would also put `data/` back into Vite's module graph, and then every edit
         * of a story file would fully reload the page. Type-only imports (`import type`, or
         * `import { type X }`) vanish at build time and stay legal.
         */
        files: ['Visualizer/client/**/*.{ts,tsx}'],
        rules: {
            '@typescript-eslint/no-restricted-imports': [
                'error',
                {
                    paths: ['@story/data', '@story/core'].map((name) => ({
                        name,
                        allowTypeImports: true,
                        message: `Visualizer/client must not import ${name} at runtime — load story data through src/api (plan §3 "Live refresh"). \`import type\` is fine.`,
                    })),
                    patterns: [
                        {
                            group: ['@story/data/*', '@story/core/*'],
                            allowTypeImports: true,
                            message:
                                'Visualizer/client must not import the story at runtime — load it through src/api (plan §3 "Live refresh"). `import type` is fine.',
                        },
                    ],
                },
            ],
        },
    },
    {
        /**
         * Multiple stories, phase 9: SingleEngine plays whichever story `?story=` names, loaded at
         * run time (`src/worldState.ts#loadStory`). `@story/data` / `@story/types` resolve only
         * from a file inside a story (`SingleEngine/vite/storiesPlugin.ts`), so a value import of
         * either from the app would fail in the dev server. Type-only imports stay legal: the app
         * type-checks against the example.
         */
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
        /**
         * Multiple stories, phase 1: `core` is story-agnostic. The story reaches the engine by
         * injection (`TStoryModule`, `engine.storyModule`), never by import, so the same runtime
         * can play any story. Type-only imports stay legal — `TWorldState` is the story's shape.
         */
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
        /**
         * The story template (see `templateZones`). `@story/types` / `@story/data` resolve through
         * its own `tsconfig.json` to its own folders, like a story's. `{}` data types are allowed:
         * the server writes `export type T<Id>Data = {}` for every chapter and entity it creates,
         * and a new story should look like what the server generates.
         */
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
