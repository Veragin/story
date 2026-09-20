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
 * `@story/data`'s `"./*"` export. The one gap is the *extension-less directory* subpath
 * `@story/data/assets`, which `"./*"` maps to a folder rather than a file — the apps paper over
 * it with a dedicated alias, and the `data` tests simply import `../assets` because they live
 * inside that package anyway. Nothing else needed an alias, so nothing else has one.
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
            name: 'data',
            root: './data',
            environment: 'node',
            include: ['test/**/*.test.ts'],
        },
    },
]);
