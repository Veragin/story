import { defineWorkspace } from 'vitest/config';

/**
 * Vitest projects — one entry per workspace package that has tests (REFACTOR_PLAN §7).
 *
 * ## Why there is no `resolve.alias` here
 *
 * The three Vite apps each carry an explicit `@story/*` → source alias list, because they need
 * an *edit* in a sibling package to be a plain module-graph invalidation so HMR crosses the
 * package boundary. A test run has no HMR and no dev server, so it needs none of that: every
 * internal package is a real workspace with a `node_modules/@story/*` symlink and an `exports`
 * map pointing straight at its `.ts` entry, and Vite resolves through both. Bare `@story/core`,
 * `@story/types`, `@story/shared` and `@story/data` therefore work here with zero configuration,
 * and deep imports (`@story/data/chapters/village/village.chapter.ts`) resolve through
 * `@story/data`'s `"./*"` export (the workspace lives at `stories/example/data/`). Nothing
 * needed an alias, so nothing has one.
 *
 * ## Why both projects are `node`
 *
 * §7 says jsdom "only where a DOM is needed", and neither of these needs one: `@story/core` is
 * the headless runtime and `@story/data` is plain data plus pure functions. The one browser API
 * that does show up — `Engine`'s bare `localStorage` — is stubbed by `core/test/setup.ts`
 * rather than conjured by switching the whole project to jsdom; a DOM is not what the engine is
 * missing, one storage API is, and hiding that behind an environment would bury the coupling
 * the future MultiEngine node server has to deal with. When the React packages (`ui`,
 * `SingleEngine`, `Visualizer/client`) get tests, those are the entries that take
 * `environment: 'jsdom'` — `jsdom` is already a root devDependency for exactly that.
 *
 * Note: Vitest 3 prints a deprecation notice for this file in favour of `test.projects` inside
 * a root `vitest.config.ts`. It is kept because §7 names it, and moving it is a one-line change
 * whenever the repo goes to Vitest 4 — which it cannot do while the apps are on Vite 5, since
 * Vitest 4 requires Vite 6 or newer.
 */
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
            // The example story's own suite (`stories/example/data/test`). Still named `data`:
            // it is the `@story/data` workspace, only moved (multiple stories, phase 2). Other
            // stories are not workspaces and have no tests of their own.
            name: 'data',
            root: './stories/example/data',
            environment: 'node',
            include: ['test/**/*.test.ts'],
        },
    },
    {
        // The Visualizer's node server. Every test runs against a temp copy of the example story
        // (a temp `STORIES_ROOT`, or a `ProjectRoot` in it), never the real `stories/example/`
        // (plan §5).
        test: {
            name: 'visualizer-server',
            root: './Visualizer/server',
            environment: 'node',
            include: ['test/**/*.test.ts'],
        },
    },
    {
        // SingleEngine's dev-server story guard (multiple stories, phase 9): the pure request →
        // story classification and the access cache, node-side like the Vite config they serve.
        test: {
            name: 'single-engine',
            root: './SingleEngine',
            environment: 'node',
            include: ['vite/test/**/*.test.ts'],
        },
    },
    {
        // The React client. jsdom has no 2D canvas, so the setup file stubs `getContext`.
        test: {
            name: 'visualizer-client',
            root: './Visualizer/client',
            environment: 'jsdom',
            include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
            setupFiles: ['./src/canvas/test/setup.ts'],
        },
    },
    {
        // The landing page (multiple stories, phase 6): the store against a mocked `fetch`, and
        // the create dialog rendered into jsdom.
        test: {
            name: 'visualizer-landing-page',
            root: './Visualizer/landing-page',
            environment: 'jsdom',
            include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
            setupFiles: ['./src/test/setup.ts'],
        },
    },
]);
