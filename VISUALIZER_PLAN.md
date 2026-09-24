# Visualizer plan — canvas library + NestJS server

Goal: build the Visualizer described in `README.md` § Visualizer — map, timeline, chapter view,
entities, structure — on top of (a) one canvas library that every view shares, and (b) a NestJS
server that reads and writes the author's `types/` and `data/` files.

This is the piece REFACTOR_PLAN §8 deliberately left out ("the Visualizer implementation stays
as-is … its server and the README API are a later, separate piece of work"). Section numbers
below are this document's; references to `§n` of the refactor plan are written `RP §n`.

Decisions taken:

- **One canvas library, built on [Konva](https://konvajs.org) 10**, extracted into a new
  workspace package `@story/canvas`. Every canvas view in the service migrates onto it and the
  two home-grown engines are deleted. (§2, §3)
- **Everything the author edits is TypeScript.** Polygons, canvas positions, brush strokes and
  notes are written into `data/**/*.ts` and `types/**/*.ts` — no JSON sidecars, no localStorage.
  (§4, §6)
- **`Visualizer/server/` is NestJS on :8123**, `/api` prefix, run from TypeScript source with no
  build step (RP §7), reached by the client through a Vite proxy. (§5)
- **The server is a file service and a story index — not a story runtime.** It parses `data/`
  statically; passage evaluation stays in the browser, where `@story/core` already does it. (§5.1)
- **The client's existing route set wins** over the older list in the README (`/api` prefix,
  passage type in the path). README's API section is rewritten to match at the end. (§5.3)
- The two other Visualizer options the README leaves open — VS Code extension, Electron — are
  closed by this plan. Node server it is.

---

## 1. Current state

### 1.1 What exists

`Visualizer/client/` — 156 files, ~17.3k lines, a Vite app on :8101. Three tabs are reachable
(`src/Visualizer.tsx`): the world-events timeline, a chapter's passage graph, and the map editor.
`entities` and `structure` do not exist. The nav (`src/components/Nav.tsx`) offers two buttons.

**Three renderers, two of them generations of the same idea:**

| Renderer                                     | Where                                      | Used by                      |
| -------------------------------------------- | ------------------------------------------ | ---------------------------- |
| `CanvasManager` (legacy, screen coords only) | `GUIComponents/Canvas/CanvasManager/`      | timeline (`ChapterStore/**`) |
| `CanvasManagerCore` + plugins (world coords) | same folder, `CanvasManagerBuilder` builds | passage graph (`Graphs/**`)  |
| `MapEngine` (bespoke tile blitter)           | `MapEditor/MapEngine/`                     | map editor only              |

The plugin generation is the good one: `CanvasWorld` is a clean screen↔world transform with
anisotropic zoom, and `Panning`/`Zooming`/`Dragging`/`Hovering`/`Clicking` plugins sit on an event
dispatcher. What it does not have, and cannot grow cheaply, is **geometry other than an
axis-aligned box** — `VisualObject` is `{position, size}` and every hit test is
`isPointInside(point, position, size)`. Polygons are the Visualizer's central primitive
(`README`: _location knows its position by points of polygon mash shape_), so this is the wall.

**The map is tiles, not polygons.** `MapEditor/types.ts` is a `width × height` grid of palette
ids with a per-tile label, plus `{i, j} → locationId` references. Nothing in the README asks for
a tile grid; it asks for polygon locations, a brush, and notes. The tile editor is a prototype of
a different product and is replaced, not extended.

**Nothing is persisted.**

- `MapWrapper.tsx` has an unconditional `return;` after `createDefaultMapData(...)` — the
  `agent.getMap()` call below it is dead code, every reload starts from a blank 100×100 grid.
- `ChapterPassagesGraphStorageManager` writes passage positions to `localStorage` under
  `passage-graph-<chapterId>`. Per-browser, not per-story, and invisible to git.
- `stores/Store.ts` constructs `new Agent('http://localhost:3123')` — a port no config in this
  repo mentions, for a server that does not exist. Every `Agent` method fetches, fails, and
  toasts.

**Undo/redo already exists and is renderer-agnostic**: `GUIComponents/MementoSystem/**` (~700
lines, its own processors and registry). It survives this plan unchanged, it just moves.

**Graph layout is renderer-agnostic too**: `Graphs/graphLayouts/**` (Kamada-Kawai, spring,
circular, left-to-right seeding). Same — moves, does not change.

### 1.2 What the data cannot express yet

| README requirement                     | Missing                                                                    |
| -------------------------------------- | -------------------------------------------------------------------------- |
| location as a polygon mesh             | `types/TLocation.ts` has no geometry at all                                |
| map, brush strokes, river notes        | there is no map type and no `data/maps/` — maps exist only in the dead API |
| passage positions "saved to solo file" | positions live in `localStorage`                                           |
| location colour                        | no field                                                                   |
| structure tab edits `types/`           | no writer, and `types/` is hand-written TypeScript                         |

### 1.3 Baseline

`yarn typecheck`, `yarn lint`, `yarn test` and `make start` are the gates every phase below ends
on. Phase 0 records their current output so a phase that breaks one is distinguishable from a
phase that inherited it.

---

## 2. Decision: Konva, and everything migrates

**Chosen:** a new `@story/canvas` package wrapping Konva; the map editor is built on it first,
then the passage graph, then the timeline; `GUIComponents/Canvas/**` and `MapEditor/MapEngine/**`
are deleted in the last phase.

Why not keep the in-house engine: the missing 20% is the expensive 20%. Polygon hit-testing,
per-vertex handles with correct z-order and cursor feedback, hit-region caching for a map with
hundreds of shapes, freehand stroke smoothing, text metrics for notes at arbitrary zoom, and
retina/DPR correctness — that is a rendering library, and we would be maintaining one instead of
a story tool. Konva ships all of it (`Shape.hitFunc`, `Layer` hit graphs, `cache()`/`FastLayer`,
`Transformer`, DPR handling) with ~10 years of edge cases already found.

What Konva does **not** ship, and this plan therefore builds (§3.2): per-vertex polygon editing
(Konva's `Transformer` scales and rotates a shape, it does not move its points), a tool state
machine, snapping, and the domain objects (passage node box, edge arrow, timeline axis).

Cost, stated plainly: the passage graph and the timeline work today and both get rewritten
against a new scene API. §7 phases them after the map so the library is proven before the risky
migrations, and each migration is its own phase with its own gate.

Rejected alternatives: **Fabric.js** (object-model canvas with built-in controls, but its
strength is free-form document editing and its polygon vertex editing is recipe-level too, with a
heavier object model to fight); **PixiJS** (WebGL, far faster than we need, no interaction
primitives, hostile to crisp text at zoom); **Paper.js** (best vector/path model of the three —
boolean ops, hit-testing with tolerance — but a smaller ecosystem and no React story, and we do
not need path booleans); **react-konva** (React reconciler over Konva — rejected because the
Visualizer's state is mobx class stores driving imperative scene objects, and putting the
reconciler in the middle would mean re-rendering React on every drag frame).

---

## 3. `@story/canvas`

### 3.1 Placement

A new top-level workspace, beside `ui/` and `core/`:

```
canvas/                      @story/canvas    → shared          (konva)
├─ package.json              exports "." and "./react"
├─ tsconfig.json
├─ src/
└─ test/
```

Layering (RP §2, extended): `canvas` imports `@story/shared` and nothing else internal — no
`types`, no `data`, no `core`. It is a rendering library that happens to live in this repo; the
day it renders something that is not this story, nothing has to be untangled. React is a **peer**
dependency, used only by the `./react` subpath (one host component, ~40 lines: a `div`, a
`ResizeObserver`, scene lifecycle). `eslint.config.js` gets `canvas` in `PACKAGES` and a zone
saying it may import only `shared`.

### 3.2 Surface

```
src/
├─ scene/
│  ├─ Scene.ts            Konva.Stage + the four layers below; mount/destroy; resize
│  ├─ Layers.ts           background | content | overlay (handles, guides) | interaction
│  ├─ Viewport.ts         pan, zoom-at-point, anisotropic zoom, fit-to-bounds, WSAD/arrows
│  └─ SceneObject.ts      base: id, z, selectable, draggable, bounds, toJSON/fromJSON
├─ objects/
│  ├─ PolygonObject.ts    points in world units, fill/stroke/opacity, label, hitFunc
│  ├─ BoxObject.ts        rounded rect + text — the passage/chapter node
│  ├─ EdgeObject.ts       arrow between two objects, side-aware anchoring
│  ├─ NoteObject.ts       free text placed in world space, zoom-stable sizing
│  ├─ BrushStroke.ts      one stroke: colour, width, points (see §4.3 on size)
│  └─ ImageObject.ts      map background / passage art
├─ tools/
│  ├─ Tool.ts             interface: activate/deactivate + normalised pointer events (world coords)
│  ├─ SelectTool.ts       click, shift-click, marquee, drag-move, double-click → open
│  ├─ PolygonDrawTool.ts  click to add vertex, close on first-vertex click or Enter, Esc cancels
│  ├─ VertexEditTool.ts   drag vertex, alt-click to delete, click on edge midpoint to insert
│  ├─ BrushTool.ts        hold to draw, colour + size
│  ├─ NoteTool.ts         place / edit a note
│  └─ ToolManager.ts      exactly one active tool; cursor; Esc always returns to select
├─ interaction/
│  ├─ Selection.ts        selected set, observable, keyboard (Del, Esc, Ctrl+A)
│  ├─ Snapping.ts         grid snap, vertex snap, close-polygon threshold — all in world units
│  └─ Keyboard.ts         WSAD/arrows pan, +/- zoom, Ctrl+Z/Ctrl+Shift+Z
├─ layout/                 moved verbatim from Graphs/graphLayouts/**
├─ history/                moved verbatim from GUIComponents/MementoSystem/**
├─ geometry/               polygon math: area, centroid, bbox, point-in-polygon, simplify (RDP), self-intersection test
└─ react/CanvasHost.tsx    the only React file; peer-dep react
```

Design rules for the package, each of which is a review criterion:

1. **World units everywhere.** Every public API takes and returns world coordinates. Screen
   pixels appear in exactly one place, `Viewport`.
2. **No story types.** A polygon knows it has an `id` and arbitrary `meta`; it does not know what
   a `TLocationId` is. Mapping is the Visualizer's job.
3. **Objects are observable, not React.** `SceneObject` emits change events (`@story/shared`'s
   `Observer`), stores subscribe. No render loop in React.
4. **Every mutation goes through history.** Tools emit commands; `history/` records them. Undo is
   not retro-fitted later.
5. **Serialisable.** `toJSON`/`fromJSON` on every object, because §4 persists them as TypeScript
   literals and the same shape is what the server writes.

### 3.3 Testing

Konva in Node needs the native `canvas` package, which this repo should not take on. So: all
pure modules (`geometry/`, `layout/`, `Viewport` math, `Snapping`, `history/`) are unit-tested
under Vitest in a `node` environment with no Konva import; scene/tool behaviour is tested in
`jsdom` against a **fake renderer** — `Scene` takes a renderer port, Konva is the production
implementation. Adds one indirection, buys testable tools and keeps the native dep out.
`vitest.workspace.ts` gains a `canvas` project.

---

## 4. Data model — what gets written where

Decision: **everything as TypeScript, in the author's tree**. Each item below is a new or changed
author-visible field, so each is also a README edit in §7 Phase 11.

### 4.1 Geometry lands in `shared`

`shared/src/geometry.ts` already exports `TPoint`/`TSize`/`TVec`. It gains `TPolygon`
(`readonly TPoint[]`), `TBBox`, and `TColor` (a `TFlavor<string>`). Engine types the author never
edits — RP §2.1 puts exactly this kind of thing in `shared`, not `types`.

### 4.2 `types/TLocation.ts` — the polygon

```ts
export type TLocation<L extends TLocationId> = {
    // … existing fields …
    /** Where this location sits on a map. Written by the Visualizer's map tab. */
    shape?: {
        mapId: TMapId;
        points: TPolygon; // world units, clockwise, implicitly closed
        color: TColor;
        z?: number;
    };
};
```

Optional: a story with no map stays valid, and the existing two locations need no edit.

### 4.3 `types/TMap.ts` — new, and `data/maps/`

The map itself has nowhere to live today. A map is an author entity like a location, so it gets a
type and a folder:

```ts
export type TMap<M extends TMapId> = {
    id: M;
    title: string;
    size: TSize; // world units
    background?: { asset: string; position: TPoint; size: TSize };
    notes: {
        id: string;
        text: string;
        position: TPoint;
        rotation?: number;
        color?: TColor;
    }[];
    strokes: { id: string; color: TColor; width: number; points: number[] }[]; // flat x,y pairs
    maps?: { mapId: TMapId; position: TPoint }[]; // nested maps, replacing the tile `maps` list
};
```

`data/maps/<mapId>.map.ts` holds one per map; `data/register.ts` gains a `maps` entry, and
`TMapId` derives from it the way `TLocationId` derives from `register.locations`.

**Brush strokes are the one place where "everything in TypeScript" costs something**, so three
mitigations are part of Phase 6, not afterthoughts: coordinates are rounded to integers, every
stroke is simplified with Ramer–Douglas–Peucker (ε = 1 world unit) on mouse-up before it is ever
persisted, and the server rejects a `strokes` payload over a configured budget (default 2 MB per
map) with `413` rather than writing a file no one can merge. A flat `number[]` rather than
`TPoint[]` roughly halves the character count and is Konva's native `Line.points` format.

### 4.4 `types/TChapter.ts` — passage positions

```ts
export type TChapter<E extends TChapterId> = {
    // … existing fields …
    /** Canvas position of each passage in the chapter view. Written by the Visualizer. */
    layout?: Partial<Record<TChapterPassageId<E>, TPoint>>;
};
```

This is the README's _"save position of passages to solo file"_, answered by putting it in the
chapter file the positions belong to — keyed by the existing `<chapter>-<character>-<passage>` id
format, so a renamed passage leaves a dangling key that the client drops and the next save
prunes. It replaces `localStorage` entirely; `ChapterPassagesGraphStorageManager`'s storage half
is deleted in Phase 7 (the in-memory cache stays).

### 4.5 Generated-code conventions

Anything the server writes obeys three rules, enforced by the writer tests in Phase 5:

1. **Formatted by the repo's own Prettier**, loaded from `.prettierrc` at runtime — a file the
   server touched must be byte-identical to what `yarn pretty` would produce, or the next
   `pretty` run turns every author edit into a diff war.
2. **Property-level edits only.** The writer locates a named property of a named export and
   replaces its initializer. It never re-prints a file, never reorders, never drops a comment,
   and never touches a passage's function body. If the property is missing it is appended; if the
   export is not an object literal (a passage is a _function_), the writer refuses with `422` and
   an explanatory message rather than guessing.
3. **No markers, no fences.** No `// GENERATED — DO NOT EDIT` regions. The author is expected to
   hand-edit these files; that is the whole point of the fork-per-story design (RP §2.1).

---

## 5. `Visualizer/server/` — NestJS on :8123

### 5.1 Shape

```
Visualizer/server/            @story/visualizer-server        node :8123
├─ package.json               dev: run from source, no dist (RP §7)
├─ tsconfig.json              experimentalDecorators + emitDecoratorMetadata
├─ .swcrc
└─ src/
   ├─ main.ts                 bootstrap, global /api prefix, ValidationPipe, port 8123
   ├─ app.module.ts
   ├─ story/                  the read model — ts-morph index of data/ + types/
   │  ├─ StoryIndexService.ts  parse once, keep in memory, invalidate on watch event
   │  └─ SourceFileService.ts  repo-root resolution, path allowlist, read/write, hashes
   ├─ writer/
   │  ├─ TsWriterService.ts    ts-morph: set property of named export, preserve everything else
   │  └─ FormatterService.ts   Prettier with the repo config
   ├─ chapter/ passage/ location/ map/ entity/ structure/    one Nest module each
   ├─ editor/EditorController.ts   POST …/open → `code -g <file>:<line>`
   └─ events/EventsController.ts   GET /api/events — SSE, chokidar on data/ + types/
```

**Not a runtime.** The server never constructs an `Engine`. Two reasons: passages are functions
of `(s, e)` and evaluating them server-side would mean simulating the story to list it; and
`@story/core`'s `Engine` reaches for a bare `localStorage` as its save store
(`core/src/engine/Engine.ts:47,51,55`, called from the constructor), which does not exist under
node. The index is built statically with ts-morph — ids, titles, types, link targets, positions —
and anything needing live state stays in the browser, where the client already runs
`@story/core`. The server may still `import { register } from '@story/data'` for read-only
metadata: `buildWorldState` itself is node-safe, it is only `Engine` that is not.

### 5.2 Running it — the one real unknown

The constraint is **run TypeScript from source, no build step** (RP §7) — not `tsx` specifically.
It comes from the packages themselves: `@story/data` exports `./index.ts`, `@story/core` exports
`./src/index.ts`, and `tsconfig.base.json` sets `noEmit` + `allowImportingTsExtensions` +
`moduleResolution: bundler`. A server that imports them is importing `.ts` files outside its own
`rootDir` that are configured never to be emitted, and putting a compile step in front of the
server also puts one in front of the author's edit-a-passage-and-reload loop.

The runner this repo reaches for, `tsx`, is esbuild, and NestJS resolves constructor
dependencies through `design:paramtypes` — a **type-directed** emit that esbuild documents as
unsupported, because it never builds a type table. Verified in this repo: the same class through
`tsc -p` emits `__metadata("design:paramtypes", [FooService])`; through
`node_modules/.bin/esbuild` with the identical tsconfig it emits no metadata at all, so Nest sees
`undefined` and throws `Nest can't resolve dependencies of the X (?)`. Three options, in order:

1. **`@swc-node/register`** (swc _does_ emit decorator metadata): dev is
   `node --import @swc-node/register/esm-register src/main.ts` with a `.swcrc` setting
   `decoratorMetadata: true`. Keeps RP §7's no-build-step rule, and swc compiles the sibling
   workspace `.ts` sources the same way tsx does today. **This is the intended path.**
2. Explicit `@Inject(TOKEN)` on every constructor parameter — parameter decorators _are_ emitted
   by esbuild, so this runs under plain `tsx`. Verbose but bulletproof.
3. `nest build` to `dist/` — rejected: it means compiling the sibling source-only packages too,
   and a `dist/` the rest of the repo does not have.

Option 1 is a **Phase 0 spike with a go/no-go gate** (§7). If it fails, Phase 4 adopts option 2
and the plan loses nothing but elegance.

### 5.3 API

The client's `Agent.ts` routes become authoritative; the README's older list is replaced. All
JSON, all under `/api`, all `4xx` with `{ success: false, error }`.

```
GET    /api/health
GET    /api/story                      ids + titles of everything, one round trip at boot
GET    /api/events                     SSE: {type:'changed', path} when data/ or types/ change on disk

PUT    /api/chapter/:chapterId         title, description, location, timeRange, children
POST   /api/chapter/:chapterId/setTime startTime, endTime
POST   /api/chapter/:chapterId/open
DELETE /api/chapter/:chapterId
PUT    /api/chapter/:chapterId/layout  { [passageId]: TPoint }            → §4.4

GET    /api/passage/:type/:passageId
PUT    /api/passage/:type/:passageId   type ∈ screen | linear | transition
POST   /api/passage/:type/:passageId/setTime
POST   /api/passage/:type/:passageId/open
DELETE /api/passage/:type/:passageId

GET    /api/map                        list
GET    /api/map/:mapId
PUT    /api/map/:mapId                 title, size, background, notes, strokes  → §4.3
DELETE /api/map/:mapId

GET    /api/location                   list
GET    /api/location/:locationId
PUT    /api/location/:locationId       fields + shape (polygon, colour)         → §4.2
POST   /api/location/:locationId/open
DELETE /api/location/:locationId

GET    /api/entity                     the entity kinds and their members (entities tab)
GET    /api/entity/:kind/:id
PUT    /api/entity/:kind/:id
DELETE /api/entity/:kind/:id

GET    /api/structure                  the types/ model: type aliases and their fields
PUT    /api/structure/:typeName        add/edit/remove fields                    → Phase 10
POST   /api/structure/:typeName/open
```

**Optimistic-concurrency on every write**: the read that produced the edit returns a content hash;
the write sends it back in `If-Match`; a mismatch is `409` and the client refetches. Without it,
the file watcher and a hand edit in VS Code silently overwrite each other — a real scenario, since
`POST …/open` exists specifically to send the author to their editor.

### 5.4 Wiring

- `Visualizer/client/vite.config.ts` gains `server.proxy['/api'] = 'http://localhost:8123'`, and
  `stores/Store.ts` drops `http://localhost:3123` for a same-origin `''`.
- `docker-compose.yml` publishes `8123:8123` (the comment reserving it is removed).
- Root `package.json`: `dev:visualizer-server`; `yarn dev`'s `foreach` picks it up automatically.
- `Makefile`: `dev-visualizer-server`, beside the existing per-service targets.
- `eslint.config.js`: the `SERVICES` zones already cover `./Visualizer` as a whole — no change
  needed, which is the point of RP §7's rule shape.
- `tsconfig.json` gains the server to `references`/`include`; `tsconfig.node.json` gains nothing
  (the server has its own config because of the decorator flags).

---

## 6. Requirement → phase map

Every bullet of README § Visualizer, and where it is satisfied. This table is the acceptance
checklist.

| README bullet                                              | Phase  |
| ---------------------------------------------------------- | ------ |
| map: display locations on canvas                           | 6      |
| map: zoom on scroll, WSAD/arrows to move                   | 1, 6   |
| map: brush tool — colour, size, hold to draw               | 2, 6   |
| map: notes (draw a river, name it)                         | 2, 6   |
| map: add/edit/remove location as polygon mesh              | 2, 6   |
| map: double-click opens location view                      | 6, 9   |
| map: click selects; colour change; drag to move            | 2, 6   |
| location view: form                                        | 9      |
| timeline: chapters per character, character selector       | 8      |
| timeline: drag to move the timeline                        | 8      |
| timeline: add/delete chapter; select; drag; double-click   | 8      |
| timeline: connections toggle, description on hover         | 8      |
| timeline: time-trigger toggle, double-click → trigger view | 8, 9   |
| chapter view: add/edit/delete passages                     | 7      |
| chapter view: boxes, drag, arrows between passages         | 7      |
| chapter view: passage positions persisted                  | 4.4, 7 |
| chapter view: chapter info in a modal form                 | 7      |
| time-trigger view: form                                    | 9      |
| entities: menu, per-entity lists, open and edit            | 9      |
| structure: define/edit entities, edit `types/`             | 10     |

---

## 7. Phases

Each phase ends green on `yarn typecheck`, `yarn lint`, `yarn test`, and `make start` bringing
SingleEngine (:8100), the Visualizer client (:8101) and — from Phase 4 — the Visualizer server
(:8123) up. Phases 1–3 are additive — nothing in the running app changes until Phase 6 — so the
app stays usable throughout.

**MultiEngine is out of scope.** It is a scaffold awaiting reimplementation, so nothing here
treats it as precedent, depends on it, or gates on it. Two consequences worth stating, because
both cut in this plan's favour: the `Visualizer/server/` runner is chosen on its own merits
rather than to match `MultiEngine/server`'s `tsx`, and `@story/canvas` being a standalone package
that imports only `@story/shared` (§3.1) means a future MultiEngine client can adopt it without
inheriting anything Visualizer-specific.

### Phase 0 — baseline and three spikes

Record current `typecheck`/`lint`/`test` output. Then, timeboxed, in `/tmp`, thrown away after:

1. **Decorator metadata (§5.2).** A two-provider Nest app under `@swc-node/register`, importing
   `@story/data`. Gate: it boots and injects. Fail → Phase 4 uses explicit `@Inject`.
2. **Konva at scale.** 500 polygons of ~40 vertices plus 2 000 brush points, pan and zoom.
   Gate: 60 fps pan on the dev container. Fail → add `Layer.cache()`/`FastLayer` for the brush
   layer to Phase 2's scope before building on it.
3. **ts-morph round-trip.** Read `data/chapters/village/village.chapter.ts`, set one property,
   write, Prettier. Gate: `git diff` shows only that property, comments and formatting intact.
   Fail → §4.5 rule 2 tightens to "refuse" for more shapes, and the affected endpoints return
   `422` until a safe writer exists.

### Phase 1 — `@story/canvas` skeleton

Workspace, `package.json`/`tsconfig`/eslint zone/`vitest.workspace.ts` entry. `Scene`, `Layers`,
`Viewport` (pan, zoom-at-point, anisotropic zoom, fit, WSAD), `SceneObject`, the renderer port and
its fake, `react/CanvasHost`. `geometry/` and `history/` and `layout/` moved in (moves, not
rewrites — `git mv`, then fix imports). Gate: viewport and geometry unit tests; a scratch route in
the client renders 3 boxes and pans/zooms.

### Phase 2 — polygons and tools

`PolygonObject` with `hitFunc` and point-in-polygon, `PolygonDrawTool`, `VertexEditTool`,
`SelectTool`, `BrushTool`, `NoteTool`, `ToolManager`, `Selection`, `Snapping`, undo/redo wired
through `history/`. Gate: tool-level tests against the fake renderer; the scratch route becomes a
throwaway harness where a polygon can be drawn, reshaped, recoloured, moved, deleted and undone.

### Phase 3 — data model

§4 in full: `shared` geometry additions, `TLocation.shape`, `types/TMap.ts`, `TChapter.layout`,
`data/maps/global.map.ts`, `register` wiring, `TMapId`. Author-surface change, so `data/test/`
grows cases and the README's Data-structure section is updated in the same commit. Gate:
`yarn test`, and the existing story still plays in SingleEngine untouched.

### Phase 4 — server skeleton, read-only

Nest on :8123 per §5.1/§5.2, Vite proxy, compose port, Makefile, root script. `GET /api/health`,
`GET /api/story`, `GET /api/map*`, `GET /api/location*`, all from `StoryIndexService`'s ts-morph
index. `SourceFileService` path allowlist (only `data/` and `types/`, no traversal, no symlink
escape) with tests that try to escape. Gate: `curl` the read routes in the container; client's
`Agent` reads through the proxy.

### Phase 5 — writers

`TsWriterService` + `FormatterService` + `If-Match` concurrency + the SSE watcher. Every `PUT`,
`DELETE` and `POST …/open` in §5.3 except `structure`. Tested against a fixture story copied to a
temp dir, asserting on the resulting file text — including the refusal cases (§4.5 rule 2) and the
`413` stroke budget. Gate: writer suite green; editing a chapter in the client changes exactly one
property in `data/chapters/**`, and HMR reloads the app.

### Phase 6 — the map tab, rebuilt

The first real consumer. Locations as polygons on `@story/canvas`, brush layer, notes, select,
drag, colour, double-click to open, zoom/WSAD, save through `PUT /api/map/:id` and
`PUT /api/location/:id`. `MapEditor/MapEngine/**`, `MapEditor/types.ts`'s tile model and
`createDefaultMapData` are deleted; `MapStore` is rewritten against the scene. Gate: every map row
of §6's table demonstrable; reload restores from `data/`, not from a default grid.

### Phase 7 — chapter view (passage graph)

`Graphs/ChapterPassagesGraph/**` migrates from `CanvasManagerCore` to `@story/canvas`
(`BoxObject`/`EdgeObject`); layouts already moved in Phase 1. Positions persist through
`PUT /api/chapter/:id/layout`; the `localStorage` half of
`ChapterPassagesGraphStorageManager` is deleted. Passage add/edit/delete wired to the passage
routes; the existing creation forms are reused as-is. Gate: open a chapter, drag a passage,
reload, position holds; `git diff` shows it in the chapter file.

### Phase 8 — timeline

`ChapterStore/TimelineRender/**` and `TimelineChapters/**` migrate off the legacy `CanvasManager`
onto `@story/canvas` (anisotropic zoom is `Viewport`'s, from Phase 1). Character selector, chapter
add/delete/select/drag/double-click, connection toggle, hover description, trigger toggle. Gate:
every timeline row of §6; legacy `CanvasManager` has no remaining importer.

### Phase 9 — entities, location view, trigger view

The `entities` tab (menu of kinds → list → editor) plus the location and time-trigger forms the
map and timeline double-clicks open. Generic entity editor driven by `GET /api/entity`. Gate:
every entities/location/trigger row of §6.

### Phase 10 — structure tab (`types/`)

Highest risk and deliberately last: adding, editing and removing fields on the author's type
aliases through ts-morph, and adding a new entity kind (type + `data/` folder + `register` entry).
Constraints: only type aliases whose shape the reader recognises are editable, everything else is
read-only with an explanation in the UI; every write is preceded by a `tsc` check of the affected
files and rolled back if it fails. Gate: add a field to `TLocation`, see it in the entity editor,
and `yarn typecheck` still passes.

### Phase 11 — delete and document

`GUIComponents/Canvas/**`, `stores/CanvasHandler.ts`, the legacy `CanvasManager`, any leftover
`localStorage` persistence. README: ports table (8123 published and implemented), Visualizer
section (it is a node server; the other two options are closed), the API section replaced by
§5.3, the Data-structure section covering maps and polygons. Gate: `rg 'GUIComponents/Canvas'`
returns nothing; all four gates green.

---

## 8. Risks

1. **Decorator metadata under swc** (§5.2). Highest-probability blocker, first thing spiked, with
   a mechanical fallback. Impact if both fail: verbose DI, no schedule change.
2. **ts-morph writing files the author also hand-edits.** The scenario that loses work is a
   writer that re-prints a passage file and drops logic. Mitigated by §4.5 rule 2 (property-level
   only, refuse when unrecognised), `If-Match`, and writer tests that assert on file _text_. A
   further backstop worth taking: the server refuses to write when `git status` shows the target
   file dirty _and_ the request carries no `If-Match`.
3. **Brush strokes in TypeScript** (§4.3). Rounding + RDP + a size budget keep it merge-able; if a
   real author still blows past it, the escape hatch is a `background` image baked from the
   strokes, which `TMap.background` already allows.
4. **Two canvas engines live at once, Phases 6–8.** Unavoidable given the migration order, and
   time-boxed by Phase 11. The gate that keeps it honest: no _new_ code may import
   `GUIComponents/Canvas` after Phase 6 (an eslint `no-restricted-imports` rule added in Phase 6
   and deleted in Phase 11 along with the folder).
5. **Konva in Node tests** (§3.3). Solved by the renderer port; the cost is one indirection, paid
   in Phase 1 where it is cheap, not in Phase 8 where it would not be.
6. **`types/` editing generating invalid TypeScript** (Phase 10). Typecheck-then-rollback, and a
   conservative reader that declines anything it does not fully understand.
7. **Scope.** Eleven phases is a lot, and Phases 1–6 are the ones that pay for themselves: a
   polygon map editor backed by real files. 7–10 are migrations and screens that can be
   reordered or dropped without invalidating what came before.
