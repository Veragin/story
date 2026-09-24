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
    {
        /**
         * `@story/canvas` (VISUALIZER_PLAN §3.3). `jsdom`, not `node` — and the reason is the
         * one thing §3.3 is actually about: Konva cannot run under node without the native
         * `canvas` package, so `Scene` talks to a renderer *port* and the tests drive it with
         * `FakeRenderer`. The fake needs no DOM either, but `Scene.mount` takes an
         * `HTMLElement` and uses a `ResizeObserver`, and conjuring those by hand in every test
         * would be more fiction than using the environment that has them. Konva itself is never
         * imported by a test.
         *
         * The pure modules — `geometry/`, `layout/`, `Viewport` math — do not care which
         * environment they run in, and are in the same project rather than a second one so that
         * `yarn test` stays one pass over one file list.
         */
        test: {
            name: 'canvas',
            root: './canvas',
            environment: 'jsdom',
            include: ['test/**/*.test.ts'],
        },
    },
    {
        /**
         * `@story/visualizer-server` (VISUALIZER_PLAN §7, Phases 4–5). `node`, because it is a
         * node server: it reads and writes real files in a temp directory and there is no DOM
         * anywhere in it.
         *
         * `esbuild.tsconfigRaw` is load-bearing. The server's sources carry NestJS decorators,
         * and Vite's esbuild transform defaults to the TC39 standard proposal, under which
         * `@Injectable()` on a class with parameter properties is a syntax error. The server's
         * own `tsconfig.json` sets `experimentalDecorators`, but esbuild does not read a
         * tsconfig from a directory other than the Vite root, so it is restated here.
         *
         * `emitDecoratorMetadata` is deliberately *not* set: esbuild cannot emit it (that is
         * §5.2's whole finding, and the reason the server runs under swc rather than tsx), and
         * asking for it would only produce a warning. Nothing under test needs it — these tests
         * construct services directly rather than through Nest's injector, precisely so that
         * what they exercise is the file and writer logic rather than the DI container.
         */
        test: {
            name: 'visualizer-server',
            root: './Visualizer/server',
            environment: 'node',
            include: ['test/**/*.test.ts'],
        },
        esbuild: {
            tsconfigRaw: {
                compilerOptions: {
                    experimentalDecorators: true,
                    useDefineForClassFields: false,
                    target: 'es2022',
                },
            },
        },
    },
]);
