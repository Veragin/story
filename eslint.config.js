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
 *   core      →  shared, types, data
 *   data      →  shared, types, core
 *   services  →  any package, but never another service
 *
 * Two documented exceptions this rule deliberately does NOT flag:
 *
 *  1. `types ⇄ data` is an accepted **type-only** cycle. `types/{ids,TChapter,TCharacter,
 *     TLocation,TItem}.ts` derive their id unions from the author's actual data,
 *     which is the point of §2.1 — the two author-edited folders are one surface. Every one
 *     of those imports is an `import type`, so it vanishes at runtime.
 *  2. **`core → data` is a real value edge and a known wart**: `Processor`/`History` import
 *     `register`, `Story`/`Inventory` import `itemInfo`. It is documented at the top of
 *     `core/src/index.ts`; the fix is injecting the register the way `createWorldState`
 *     already does, and it is out of scope for a refactor. The rule encodes the layering as
 *     it *is*, not as it should be — a rule that fails on the current tree teaches people to
 *     disable it.
 *
 * The hard invariant §7 actually asks for — and the one that keeps a per-story fork
 * mergeable (§2.1) — is the last two zones: **nothing in `types/` or `data/` may import from
 * a service.** Author edits land in those two folders, engine changes everywhere else; a
 * single import across that line makes the next engine upgrade a manual merge.
 */
const SERVICES = ['SingleEngine', 'Visualizer', 'MultiEngine'];

/** `import/no-restricted-paths` zone: `target` may not import from `from`. */
const zone = (target, from, message) => ({ target, from, message });

/** Every package directory except the ones listed — used to express "may import only X". */
const PACKAGES = ['types', 'data', 'shared', 'ui', 'core'];
const packagesExcept = (...allowed) => PACKAGES.filter((p) => !allowed.includes(p)).map((p) => `./${p}`);

const boundaryZones = [
    /* shared is the floor: it may import nothing else internal. `parsePassageId` moved to
       `core` rather than `shared` precisely because it was shared's only edge back to types. */
    zone(
        './shared',
        packagesExcept('shared'),
        'shared/ is the bottom of the layering and may not import any other @story package.'
    ),

    /* types may import shared, and data type-only (the accepted cycle above). */
    zone(
        './types',
        packagesExcept('shared', 'data', 'types'),
        'types/ may import only @story/shared (and @story/data type-only).'
    ),

    /* ui is React-land and headless-runtime-free: no core, no data. */
    zone(
        './ui',
        packagesExcept('shared', 'types', 'ui'),
        'ui/ may import only @story/shared and @story/types — it must not reach into the runtime (core) or the story (data).'
    ),

    /* core is headless: no ui. The core → data edge is the documented wart and stays legal. */
    zone(
        './core',
        packagesExcept('shared', 'types', 'data', 'core'),
        'core/ is headless and may not import @story/ui.'
    ),

    /* data is the author's tree: no ui either — translations and showToast live in shared
       for exactly this reason (see "Outcome / deviations" #3). */
    zone('./data', packagesExcept('shared', 'types', 'core', 'data'), 'data/ may not import @story/ui.'),

    /* THE §7 RULE. Anything under a service directory is off limits to the author's folders. */
    zone(
        './types',
        SERVICES.map((s) => `./${s}`),
        'types/ is author-edited and must never import from a service (SingleEngine, Visualizer, MultiEngine) — REFACTOR_PLAN §2.1, §7.'
    ),
    zone(
        './data',
        SERVICES.map((s) => `./${s}`),
        'data/ is author-edited and must never import from a service (SingleEngine, Visualizer, MultiEngine) — REFACTOR_PLAN §2.1, §7.'
    ),

    /* …and the packages below the services may not reach up into them either. */
    ...['shared', 'ui', 'core'].map((p) =>
        zone(
            `./${p}`,
            SERVICES.map((s) => `./${s}`),
            `${p}/ is a shared package and may not import from a service — the dependency arrow points the other way.`
        )
    ),

    /* No service may import another service. Each is its own deployable; anything two of them
       need belongs in a package. (SingleEngine's passage templates are the live example —
       §3 defers extracting them to `ui/` until MultiEngine is actually built.) */
    ...SERVICES.flatMap((target) =>
        SERVICES.filter((s) => s !== target).map((other) =>
            zone(
                `./${target}`,
                `./${other}`,
                `${target}/ must not import from ${other}/ — no service may depend on another service. Extract the shared piece into a package.`
            )
        )
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
    }
);
