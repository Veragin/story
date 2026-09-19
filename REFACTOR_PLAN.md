# Refactor plan — single Vite app → multi-service monorepo

Goal: restructure the repo to match the folder structure described in `README.md`, with each
service as its own workspace (own `package.json`, own Vite/node server).

Decisions taken:

- **README-literal folder names** at the root — no `packages/` / `services/` nesting.
- **Yarn 4 workspaces**.
- **`shared/`** is the name for the cross-service code package (README calls it `utils`).
- **Vitest** replaces mocha.
- **Ports in the 8100 range.**
- **The Visualizer implementation stays as-is** — it gets moved into its own workspace and nothing
  more. Its server and the README API are a later, separate piece of work (§8).
- **The whole project is duplicated per story.** `types/` and `data/` are the author's working
  surface and are treated as first-class top-level content, not as buried library internals (§2.1).

---

## 1. Current state

One Vite app, two HTML entries (`index.html` → engine, `visualizer.html` → visualizer), all code
under `src/code`, resolved through `baseUrl: src` path imports (`code/*`, `data/*`, `types/*`,
`time/*`, `worldState`).

**Baseline is not green.** `npx tsc -b` reports 8 errors today:

| Error | File |
| --- | --- |
| `Cannot find module 'types/THappening'` | `src/data/TWorldState.ts:15` |
| `Property 'happenings' does not exist` | `src/code/Visualizer/GUIComponents/Graphs/ChapterPassagesGraph/WorldStateCopy.ts:63` |
| `Namespace 'React' has no exported member 'ChangeChapter'` | `src/code/Visualizer/Passages/ScreenPassageCreationForm/components/BasicInfoSection.tsx:46` |
| 5 × unresolved imports / wrong method names | `src/code/Visualizer/Graphs/**` (dead duplicate tree) |

Fixing these is Phase 0 — a refactor cannot be verified against a red baseline.

### Couplings that block a clean split

1. **Visualizer → Engine.** 5 files under `Visualizer/GUIComponents/Graphs/ChapterPassagesGraph/store/`
   import `code/Engine/ts/Engine` (`PassageService`, `CharacterResolver`, `ChapterResolcer`,
   `LocationResolver`, `PassageResolver`). The Visualizer genuinely needs the story runtime to
   resolve/simulate passages — so the runtime is shared code, not SingleEngine-private.
2. **`data/` → app singleton.** `src/data/chapters/village/thomas.passages/forest.ts` imports
   `{ s }` from `src/worldState.ts`, and `src/worldState.ts` imports `code/Engine/ts/Engine` and
   sets `window.s` / `window.e`. That is `data → app → engine → data`, a cycle across three
   would-be packages. Four more `data/` files import `code/Engine/ts/{Engine,History}` for types.
3. **`code/Context.ts` mixes both services** — it declares the engine store/world-state/engine
   contexts *and* the visualizer store context in one module, so every consumer drags in both.

### Dead code / naming to clean up

- `src/code/Visualizer/Graphs/**` — 2 files, unreferenced, duplicate of the `GUIComponents/Graphs`
  tree, and the source of 5 of the 8 tsc errors. Delete.
- `src/code/Visualizer/GUIComponents/Graphs/animation.ts/` — a **directory** named `animation.ts`.
  Rename to `animation/`.
- `src/code/Visualizer/stores/ nodeServerTypes.ts` — filename has a **leading space**. Rename.
- **Mocha is gone.** Delete `.mocharc.json`, `tsconfig.test.json`, and the `mocha`, `@types/mocha`,
  `sinon`, `@types/sinon`, `ts-node` deps. They point at `test/**`, removed in commit `815eea2`.
  Keep `jsdom` — Vitest uses it as its DOM environment.
- `package-lock.json` is tracked while `packageManager: yarn@4.5.0` + `yarn.lock` are also present.
  Delete `package-lock.json`.
- `tsconfig.app.tsbuildinfo` (13 MB) is on disk and gitignored — delete locally.

---

## 2. Target layout

```
/
├─ types/                       @story/types        ← AUTHOR-EDITED
├─ data/                        @story/data         ← AUTHOR-EDITED
│
├─ shared/                      @story/shared       → types
├─ ui/                          @story/ui           → shared            (React, MUI, notistack)
├─ core/                        @story/core         → types, shared     (headless, no React)
│
├─ SingleEngine/                @story/single-engine       vite :8100
├─ Visualizer/
│  └─ client/                   @story/visualizer-client   vite :8101
├─ MultiEngine/
│  ├─ client/                   @story/multi-engine-client vite :8102
│  └─ server/                   @story/multi-engine-server node :8124
│
├─ package.json                 # private root, workspaces, orchestration scripts
├─ tsconfig.base.json
├─ eslint.config.js
└─ .prettierrc, .prettierignore
```

Dependency rule, enforced by workspace deps (nothing sideways, nothing upward):

```
types → shared → { ui, core } → data → services
```

`core` and `ui` are additions to the README's list. `core` is required because the headless story
runtime is used by all three services (SingleEngine renders it, Visualizer simulates with it,
MultiEngine's server will own it). `ui` holds the shared theme + primitives already used by both
front-ends. §9 covers the README edits.

`Visualizer/client/` is nested even though there is no server yet, so that adding
`Visualizer/server/` later is purely additive and the client never moves twice.

### 2.1 `types/` and `data/` are the author's surface

Because the whole project gets duplicated per story, the author's day-to-day editing happens in
exactly two folders. Everything else is engine plumbing they should never have to open. Three
concrete consequences:

- **No `src/` subfolder in these two packages.** Story files sit at `data/chapters/village/village.chapter.ts`,
  types at `types/TChapter.ts` — the paths the README already documents. The other packages keep
  `src/` (`shared/src/…`, `core/src/…`); the inconsistency is deliberate and in the author's favour.
- **Consumed as TypeScript source, never as a build output.** No `dist/`, no emit step between
  saving a passage and seeing it in the browser — HMR picks the edit up directly (§7).
- **Upgrade path.** Since the project is duplicated, pulling a newer engine into an existing story
  is a merge. The layering above is what keeps that merge clean: author edits land only in
  `types/`/`data/`, engine changes only in the rest. Nothing in `types/` or `data/` may import from
  a service, and lint enforces it (§7).

The Visualizer's "structure" tab (README: *user can edit required types, eg. person can have race*)
writes into `types/`, and its other tabs write into `data/` — the same two folders, which is why
they stay plain and legible rather than packaged.

### Ports

| Service | Port |
| --- | --- |
| SingleEngine (vite) | 8100 |
| Visualizer client (vite) | 8101 |
| MultiEngine client (vite) | 8102 |
| Visualizer server (vite) — *not built yet* | 8123 |
| MultiEngine server (node) | 8124 |

`docker-compose.yml` currently publishes `8180` and `5178`, neither of which any service uses —
replace with the list above.

Note: `Visualizer/client/src/stores/Store.ts:15` hardcodes `http://localhost:3123` for a server that
does not exist. Left untouched by this refactor — it moves with the rest of the Visualizer and is
addressed when that server is actually built (§8).

---

## 3. File move map

### `types/` — `@story/types` (author-edited, flat)

| From | To |
| --- | --- |
| `src/types/*.ts` | `types/` |
| — | `types/THappening.ts` **new** — currently imported but missing (Phase 0) |

`src/@types/global.d.ts` splits: `TPoint`/`TSize`/`TVec` → `types/geometry.ts` (prefer real exports
over ambient globals); `declare let _` → `ui/src/translations.d.ts`; the `Window { e, s }`
augmentation → `SingleEngine/src/global.d.ts` (a debug hook of that app only).
`src/@types/time.d.ts` → `shared/src/time/time.d.ts`, next to `Time`.

### `data/` — `@story/data` (author-edited, flat)

| From | To |
| --- | --- |
| `src/data/{chapters,characters,sideCharacters,locations,items}/**` | `data/` (shape unchanged) |
| `src/data/register.ts` | `data/register.ts` |
| `public/{story,hunter}.png` | `data/assets/` — `hunter` is referenced by two passages as `image: 'hunter'`; story art belongs with the story, where the author can add to it |

`src/data/TWorldState.ts` does **not** stay here — it moves to `core/` (see below) so that `data/`
can depend on `core/` without a cycle. It is engine plumbing, not authored content.

### `shared/` — `@story/shared`

| From | To |
| --- | --- |
| `src/time/{Time,TimeManager,const}.ts` | `shared/src/time/` |
| `src/code/utils/{Observer,throttle,typeguards,misc,parsePassageId}.ts` | `shared/src/` |

### `ui/` — `@story/ui`

| From | To |
| --- | --- |
| `src/code/components/{Basic,Text,css}.ts`, `Modal.tsx` | `ui/src/components/` |
| `src/code/theme/{theme.ts,GlobalThemeWrapper.tsx}` | `ui/src/theme/` |
| `src/code/index.css` | `ui/src/index.css` |
| `src/code/utils/createSafeContext.ts` | `ui/src/createSafeContext.ts` (React) |
| `src/code/utils/translations.ts` | `ui/src/translations.ts` (installs the global `_`) |

`showToast` currently lives in `GlobalThemeWrapper.tsx` and is imported by `Visualizer/stores/Agent.ts`.
Move it to `ui/src/toast.ts` so a non-component module isn't importing a component module.

### `core/` — `@story/core`

| From | To |
| --- | --- |
| `src/code/Engine/ts/{Engine,Story,Processor,History,Inventory,Store,const}.ts` | `core/src/engine/` |
| `src/code/utils/loadWorldState.ts` | `core/src/worldState/loadWorldState.ts` |
| `src/worldState.ts` (logic only) | `core/src/worldState/createWorldState.ts` — see §4 |
| `src/data/TWorldState.ts` | `core/src/worldState/TWorldState.ts` |

Every `from 'data/TWorldState'` (14 sites) becomes `from '@story/core'`.

### `SingleEngine/` — `@story/single-engine`

| From | To |
| --- | --- |
| `index.html` | `SingleEngine/index.html` |
| `src/engineEntry.tsx` | `SingleEngine/src/main.tsx` |
| `src/code/Engine/{Engine,Wrapper,CharacterPicker}.tsx` | `SingleEngine/src/` |
| `src/code/Engine/templates/**` | `SingleEngine/src/templates/` |
| `src/code/Context.ts` (engine half) | `SingleEngine/src/context.ts` |
| `src/worldState.ts` (singleton + `window.s/e`) | `SingleEngine/src/worldState.ts` |

### `Visualizer/client/` — `@story/visualizer-client`

Moved verbatim; no internal restructuring in this refactor.

| From | To |
| --- | --- |
| `visualizer.html` | `Visualizer/client/index.html` |
| `src/visualizerEntry.tsx` | `Visualizer/client/src/main.tsx` |
| `src/code/Visualizer/**` (minus the dead tree) | `Visualizer/client/src/` |
| `src/code/Context.ts` (visualizer half) | `Visualizer/client/src/context.ts` |

The existing subtrees (`Chapters/`, `Passages/`, `MapEditor/`, `WorldEventsEditor/`,
`GUIComponents/`, `stores/`, `components/`) keep their names and contents. Only the two renames
from §1 apply. `GUIComponents/` (Canvas, Graphs, Memento) is generic canvas machinery and is the
natural next extraction if MultiEngine ever needs it — not now.

### `MultiEngine/` — scaffold only, marked not-implemented

- `server/`: ws + http on :8124, owns `TWorldState` and drives `@story/core`'s `Engine`;
  player→character assignment; the "wait for everyone before advancing" barrier from the README.
- `client/`: vite app on :8102, reuses `@story/ui` + SingleEngine's passage templates. Extracting
  those templates into `ui/` is deferred until MultiEngine is actually built — don't generalize on
  spec.

---

## 4. The three coupling breaks

These are the only non-mechanical parts of the refactor. Do them **before** moving files, while
everything still compiles as one app — each is independently verifiable.

**(a) `worldState` singleton → factory.** Turn `src/worldState.ts` into
`createWorldState(register): { s, e }` in `core`, with no module-level side effects and no `window`
writes. Each app constructs its own instance at boot and provides it through context. Consumers:
`Engine/Wrapper.tsx`, `Engine/templates/Components/StatusBar.tsx`, `Engine/ts/Engine.ts`,
`Visualizer/.../ChapterPassageGraphProvider.ts`, and `data/.../forest.ts`.

**(b) `data/` must stop importing the app.** `forest.ts` reads the live world state at module scope
via `import { s } from 'worldState'`. Passage files should receive state as an argument — the
`TPassage` callback signature already carries context in other passages; extend it so `forest.ts`
uses the passed-in state. **This one changes the authoring format**, which is the author's surface
per §2.1 — confirm the shape before applying it, and document it in the README's data-structure
section.

**(c) Split `code/Context.ts`.** Engine contexts → `SingleEngine/src/context.ts`; visualizer store
context → `Visualizer/client/src/context.ts`. `createSafeContext` comes from `@story/ui`. The
`worldState` context is duplicated per app (3 lines each) rather than shared — sharing it would
force `ui` to depend on `core`.

---

## 5. Import rewrite

Every `baseUrl`-relative import becomes a package import. Mechanical, but ~226 files:

| Old | New |
| --- | --- |
| `types/X` | `@story/types` |
| `time/X`, `code/utils/X` | `@story/shared` |
| `code/components/X`, `code/theme/X` | `@story/ui` |
| `code/Engine/ts/X`, `data/TWorldState`, `code/utils/loadWorldState` | `@story/core` |
| `data/register`, `data/items/...` | `@story/data` |
| `code/Engine/*.tsx` | relative, inside SingleEngine |
| `code/Visualizer/*` | relative, inside Visualizer/client |

Each package exposes a single `index.ts` barrel; no deep imports across packages — except `@story/data`,
where the author's tree is the public surface and deep paths (`@story/data/chapters/village/...`)
stay legal via `exports: { "./*": "./*" }`.

Run the rewrite with `jscodeshift` or a scripted `sed` pass per rule, then let `tsc` find the misses.
`vite-tsconfig-paths` stays only for intra-package aliases; drop it if unused after the move.

---

## 6. Phases and gates

Each phase ends green — `yarn build` (all workspaces) + `yarn lint` + both apps boot and render.
Each is a separate commit; no phase leaves the repo broken.

| # | Phase | Gate |
| --- | --- | --- |
| 0 | Fix the 8 tsc errors; delete dead `Visualizer/Graphs/**`; rename `animation.ts/` dir and `' nodeServerTypes.ts'`; delete `package-lock.json`, `.mocharc.json`, `tsconfig.test.json`, tsbuildinfo | `tsc` clean — **baseline** |
| 1 | Coupling breaks (a), (b), (c) — still one package | `tsc` clean, both apps boot |
| 2 | Root workspace skeleton: root `package.json` with `workspaces`, `tsconfig.base.json`, empty `types/`, `shared/`, `ui/`, `core/`, `data/` packages | `yarn install` resolves |
| 3 | Move `types/` + `shared/`; rewrite their importers | build green |
| 4 | Move `ui/` | build green |
| 5 | Move `core/` (engine + `TWorldState` + world-state factory) | build green |
| 6 | Move `data/` | build green; editing a passage hot-reloads |
| 7 | `SingleEngine/` becomes its own vite app on :8100 | app plays a story end-to-end |
| 8 | `Visualizer/client/` becomes its own vite app on :8101 | all four tabs render as before |
| 9 | `MultiEngine/{client,server}` scaffolds | `yarn dev` starts them; they report "not implemented" |
| 10 | Vitest setup; first `core` engine tests | `yarn test` green |
| 11 | Tooling: root scripts, eslint boundaries, docker, Makefile, README | `make start` brings up every service |

Phases 3–6 are the bulk of the churn; 7–8 are mostly config.

---

## 7. Tooling changes

- **Root `package.json`**: `private: true`,
  `workspaces: ["types","data","shared","ui","core","SingleEngine","Visualizer/*","MultiEngine/*"]`,
  scripts `dev` (all services in parallel), `dev:engine`, `dev:visualizer`, `build`, `lint`,
  `pretty`, `test`. Dependencies move down into the workspace that actually imports them —
  `@mui/*`, `notistack`, `mobx` → `ui`/apps; `d3`, `ngraph.*`, `jlouvain` → `Visualizer/client`
  only; `react`/`react-dom` pinned once at the root (plus a `resolutions` entry) to avoid two copies.
- **Source-only packages, no build step.** Every internal package sets `"exports"` to its `.ts`
  source rather than a `dist/`. Vite compiles them as part of each app; the node server runs under
  `tsx`. This is what keeps §2.1 true — an author saving `data/chapters/…` sees it immediately, with
  no `tsc -b` in between. Type checking is one root `tsc --noEmit` over the whole graph via `paths`,
  not per-package composite emit. (Composite + project references is the alternative if build
  caching ever matters more than author latency; it costs the author a build step.)
- **TypeScript**: `tsconfig.base.json` with the shared strict options; each package extends it and
  adds only `include`. Root `tsconfig.json` maps `@story/*` → each package's source.
- **Vite**: one config per app, no shared root config. `resolve.alias` from `@story/*` to each
  package's source so HMR crosses package boundaries. Keep
  `esbuild.supported['top-level-await']` — `register.ts`'s dynamic passage imports rely on it.
  Keep `host: 0.0.0.0` + `strictPort` for docker. Watch config must include the sibling packages so
  edits to `data/` and `types/` trigger reload.
- **ESLint**: keep the single flat config at the root; add a boundary rule
  (`import/no-restricted-paths` or `eslint-plugin-boundaries`) encoding §2's layering — in
  particular that `types/` and `data/` may not import from any service.
- **Vitest** (replaces mocha entirely): `vitest` + `@vitest/ui` at the root, one
  `vitest.workspace.ts`, `environment: 'jsdom'` only where a DOM is needed. `sinon` is dropped in
  favour of `vi.fn`/`vi.spyOn`. Start coverage with `core` — the engine runtime is where
  regressions are silent. A schema/round-trip test over `data/` is the second target: it is the
  thing an author is most likely to break.
- **Docker / Makefile**: one container is enough; `command` runs the root `yarn dev`. Publish
  8100–8102 and 8124. Add `make dev-engine`, `make dev-visualizer`. Keep the existing
  `make ai`/`bash` targets untouched.

---

## 8. Deferred: the Visualizer server

Out of scope here, recorded so the shape is not lost. The client already speaks this protocol via
`stores/Agent.ts` + `stores/TypeConverters.ts` + `stores/' nodeServerTypes.ts'`:

```
PUT    /api/chapter/:chapterId         POST /api/chapter/:chapterId/open
DELETE /api/chapter/:chapterId         POST /api/chapter/:chapterId/setTime
PUT    /api/passage/:passageId         POST /api/passage/:passageId/open
DELETE /api/passage/:passageId
PUT    /api/map/:mapId                 GET  /api/map/:mapId    GET /api/map
```

When built, it lands at `Visualizer/server/` on :8123, the client proxies `/api` to it (replacing the
hardcoded `localhost:3123`), and it reads/writes the `.ts` files in `data/` and `types/` — writing
valid TypeScript back out while preserving hand-written passage logic is the hard part, and it is
why this is a separate piece of work rather than a phase above. Also to settle then: the client
calls `/api/chapter/...` while the README documents `/chapter/...`.

---

## 9. README updates (same PR as Phase 11)

- Rename the `utils` entry to `shared`; add `core` and `ui` with one line each on why they exist.
- State that `types/` and `data/` are the author-edited folders and that the project is duplicated
  per story — this is the README's most load-bearing fact for a newcomer and it is currently absent.
- Note that MultiEngine splits into `client/` and `server/`, and that the Visualizer will.
- Document the passage-state access change from coupling break (b) in the data-structure section.
- Leave "Not implemented/decided yet → how Visualizer will work" open; §8 is the current sketch.

---

## 10. Risks / open items

1. **Coupling break (b)** changes how passage files access world state — i.e. the authoring format,
   the one surface the author actually touches. Only one file uses it today, so it is cheap now and
   expensive after stories exist.
2. **Duplicated projects drift.** Every story is a fork of the engine, so engine fixes reach
   existing stories only by merge. Worth deciding early whether engine packages eventually ship
   from a registry instead; the layering in §2 keeps that option open without committing to it.
3. **React duplication** across workspaces breaks hooks silently — pin `react`/`react-dom` at the
   root and add a `resolutions` entry.
4. **HMR across workspace boundaries** needs `server.watch` to cover sibling packages; if it turns
   out flaky in docker (bind-mounted volume + inotify), fall back to `usePolling` for `data/`.
5. **MultiEngine remains a scaffold.** The plan makes room for it; it does not build it.
