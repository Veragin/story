# Visualizer

The author's editor for the story. It shows a hex map with location polygons, a timeline of chapters and time triggers, a Twine-like graph of each chapter's passages, and forms for the entities. It **reads and writes the story's own source files** in `data/` and `types/`, so every edit in the UI is an edit to TypeScript source that the author also edits by hand.

How to run it, the env vars, the `map.json` format and the full list of known limitations are in [`Visualizer/README.md`](../Visualizer/README.md). This file covers what you need to understand and change the service.

## Architecture

Three yarn workspaces. Dependencies go one way: **client → protocol ← server**.

| Workspace                    | Path                   | What it is                                                                           |
| ---------------------------- | ---------------------- | ------------------------------------------------------------------------------------ |
| `@story/visualizer-protocol` | `Visualizer/protocol/` | The wire contract: `ROUTES` + `TApiSpec` (`src/routes.ts`) and all DTOs (`src/dto/`) |
| `@story/visualizer-server`   | `Visualizer/server/`   | `node:http` on **:8123** (`tsx watch`). Reads and writes story source with ts-morph  |
| `@story/visualizer-client`   | `Visualizer/client/`   | React + MobX + MUI, Vite on **:8101**. Vite proxies `/api` to the server             |

Hard rules (enforced by `eslint.config.js`, check with `yarn lint`):

- The **client never imports `@story/data` or `@story/core` at runtime**; only type imports from `@story/types`. All story data comes from the server. This is also what keeps Vite from reloading the page when a story file changes.
- The **server never imports the story**; it parses it as source text.
- `protocol` imports no service code. `data/` and `types/` never import any service.

## Server (`Visualizer/server/src/`)

```
index.ts, app.ts, context.ts   startup; TServerContext = { router, project, bus }
http/        typed router (from TApiSpec), JSON body parsing, HttpError → status
routes/      one file per resource; routes/index.ts registers them, app.ts asserts none is missing
project/     ts-morph source layer
  ProjectRoot.ts     root dir (STORY_ROOT or repo root) and `paths` of every well-known file
  SourceProject.ts   one long-lived ts-morph Project; run() serialises ops; session() → commit()
  readers/           source → DTO
  writers/           DTO → minimal AST edits
  values.ts          literal ⇄ {code} conversion, Time/TimeRange/DeltaTime, refs
  registry.ts        keeps register.ts, TWorldState.ts, <ch>.passages.ts in sync; reference search
  validate.ts        in-memory type check, diagnostics with DTO field paths
json/        map.json and *.layout.json stores (validated whole-document replace)
events/      EventBus (transactions), chokidar watcher, pathToEvent, SSE, version hashing
open.ts      "open in editor" (VISUALIZER_EDITOR, default `code`)
```

### How a write works

A write handler looks like this (see `project/writers/triggers.ts`):

```ts
sp.run(async () => {
    const current = readX(sp, id);
    await assertVersion(body.version, current.version, () => current); // 409 stale
    const s = sp.session();
    s.apply(() => {
        s.edit(absFile); /* ts-morph edits on nodes */
    });
    await s.commit(bus, (texts) => ({
        kind,
        id,
        version: version(texts.get(absFile)),
        op: 'updated',
    }));
    return readX(sp, id);
});
```

`commit()` formats the changed files with the repo's prettier config and type-checks the whole project in memory. If the edit introduces **new** type errors it throws `422 invalid` with diagnostics and writes nothing. Otherwise it writes every file in one `bus.transaction`: each file is written atomically (tmp + rename) and the transaction emits exactly **one** SSE event.

Invariants to keep:

- **Edit nodes, never rewrite files.** Only the fields in the (partial) body are touched, and only the smallest node that changed is replaced. Comments, other statements and properties the reader does not understand are kept. An unchanged write must leave the file byte-identical.
- **Code fields.** An initializer that is not a plain literal (`_('…')`, expressions, closures) is read as `TCode = { code: string }` and written back verbatim. Trigger `condition`/`action` and link `onFinish` are always code. A `{code}` must be exactly one expression.
- **Versions.** Every DTO carries `version`, a content hash of its backing files: a chapter is `<ch>.chapter.ts` + `<ch>.passages.ts`, and a trigger is its chapter's `triggers.ts`. So creating or deleting a passage or trigger changes the chapter's version too.
- **Always write through `tx.writeFile`** (or `commit`), never `sourceFile.save()`. That way the watcher does not echo the server's own writes back as hand edits.
- **Registry duties.** Creating or deleting a resource also updates the files that index it by hand:
    - chapter: `<ch>.chapter.ts`, `<ch>.passages.ts`, `register.chapters`, `register.passages` (lazy import), `TWorldState.chapters`
    - passage: `<ch>/<character>.passages/<local>.ts` (`export const <local>Passage`), plus the `T<Ch><Char>PassageId` union and the `Record` in `<ch>.passages.ts`
    - character added to a chapter: the `<character>.passages/` folder with a start passage (default `intro`) and its id union. Removing the character reverses all of this, including its positions in `<ch>.layout.json`.
    - entity: its file, `register.ts`, `TWorldState.ts`. Items live in `data/items/itemInfo.ts` / `foodInfo.ts` / `toolInfo.ts`, chosen by `type` (food, tool, else itemInfo). Changing the type moves the item.
    - trigger: `triggers.ts` and the chapter's `triggers: [...]`
    - delete reverses create. It is refused with `409 referenced` while anything still points at the id, including references that would only appear as type errors.
- Hand edits are picked up on the next request: `SourceProject` stats the story files and re-parses only the changed ones.
- Tests never touch the real `data/`: `test/helpers.ts#makeTempProject()` copies `data/` + `types/` to a temp dir, and `createApp({ project, watch: false })` runs on it.

### Story file conventions the server relies on

- Passage id = `<chapter>-<character>-<local>`, so **ids never contain `-`**. Every id (chapter, character, npc, location, item, trigger, passage local id) matches `/^[a-z][A-Za-z0-9_]*$/` and is read-only (no rename). Ids become export names (`<id>Chapter`, `<local>Passage`, …).
- **A chapter's characters are the `<character>.passages/` folders in the chapter's folder**; `TChapter` has no list of them.
- Trigger ids are global (unique across chapters).
- Location geometry lives in `data/locations/map.json`, not in `*.location.ts`.
- **Story art is found by convention**: the image of a passage, character or npc is the `.png` next to its `.ts` file, with the same basename (`annie.passages/palace.ts` → `annie.passages/palace.png`, `npcs/Franta.ts` → `npcs/Franta.png`). The owner's `image` field is only a text description. `project/images.ts` resolves the owner's file the way every other route does; deleting a passage or entity deletes its `.png`. `data/assets/story.png` is only the apps' favicon.
- `data/test/story.test.ts` flags unreachable passages and characters without a start passage. Passages and characters created from the UI trip it until the author wires them up. That is intended; the server does not refuse those writes.

## Client (`Visualizer/client/src/`)

```
api/        the only way to reach story data: `api` (httpApi or mockApi), `apiEvents`, ApiError
canvas/     the Canvas library: Scene, Camera, shapes, controllers (playground at #/_canvas)
shell/      TopBar with tabs, hash router, <ControlBar> slot, modal host, keyboard helper
pages/      Map, Timeline, Chapter, Entities (each has a MobX store + components + test/)
MapEditor/  hex tile renderer ported from mapMaker, used by the Map page
components/ shared CodeField (literal ⇄ code toggle), TextField, ResizableSplitter
ui-state.ts sessionStorage view state (getUiState / setUiState / useUiState), try/catch safe
theme.ts    the single dark MUI theme
```

- **Routing** (`shell/router.ts`): `#/map`, `#/timeline`, `#/timeline/chapter/:chapterId`, `#/entities[/:kind[/:id]]`, `#/_canvas`. `shell/Shell.tsx` switches pages on `route.page`.
- **Control bar**: a page renders `<ControlBar>…</ControlBar>` anywhere in its tree, and the children are portalled into the top bar. Use at most one per page.
- **Modals**: `modals` from `shell/modals.ts` (`modals.confirm`, `modals.open`). **Keyboard**: `keyboard` / `useKey` from `shell/keyboard.ts`. Keys are ignored while an input is focused or a modal is open, unless the handler passes `allowInModal`.
- **API usage**: `import { api, apiEvents, ApiError } from '../api'`. Mutations return the new DTO; keep its `version` for the next `PUT`. For live refresh, use `apiEvents.subscribe({ kind, id?, chapterId? }, cb)`, plus `apiEvents.onResync(cb)` to refetch after a reconnect. The client's own saves are filtered out automatically. Stores that hold lists subscribe to `kind: '*'` and refetch on `op: 'created' | 'deleted'`.
- **Mock mode**: `VITE_VISUALIZER_API=mock` runs on `api/mockApi.ts` (seed data in `mockData.ts`) with no server. Tests use `createMockApi({ seed?, events? })` and `simulateExternalChange(kind, id)`. When you add or change an API method, update `api/types.ts`, `httpApi.ts` **and** `mockApi.ts`.
- **Conflict UX**: a form with unsaved input whose resource changed on disk shows "Changed on disk: Reload / Keep mine". "Keep mine" re-sends with the new version. The map merges three-way instead (`pages/Map/mergeMap.ts`). Timeline drags that answer `409 stale` are discarded, not re-applied.
- **Style**: MobX stores, `@story/ui` primitives, MUI `styled`, 4-space prettier, `_()` for user-facing strings where the surrounding code uses it.

### Canvas library (`canvas/`)

- `Scene` owns the canvas, a `Camera` (`{x, y, zoom}`, `screen = (world − {x,y}) × zoom`), layers and an on-demand render loop. Call `destroy()` to remove every listener and loop. Camera input: WASD/arrows, drag and wheel zoom.
- Shapes: `RectShape`, `PolygonShape`, `LineShape` (optionally anchored to shapes, with an optional arrowhead) and `TextShape`, each with `fill`, `stroke` and `zIndex`. A custom shape extends `Shape`.
- Controllers:
    - `SelectionController`: click selects. Only an already-selected shape can be dragged; dragging an unselected one pans.
    - `VertexEditController`: drag vertices, double-click an edge to insert one, right-click a vertex to remove it (minimum 3).
    - `LineTool`: places a line between two points.
- Double-click fires the shape's `action`. With `scene.editable = false` nothing can be edited or selected.
- In tests, jsdom has no `PointerEvent`: dispatch `MouseEvent`s named `pointerdown` etc. (`canvas/test/helpers.ts`). `canvas/test/setup.ts` stubs `getContext`.

## Pages

Behaviour that is settled (keep it unless the user asks otherwise):

- **Map** (`pages/Map/`, `MapEditor/`)
    - Two stacked canvases share one `Camera`: the hex tiles (`MapEditor/MapEngine/Draw.ts`) and the Locations `Scene` on top (`LocationsLayer.ts`). The Locations scene owns WASD/arrow input in every mode; in tiles mode its canvas is click-through.
    - Modes:
        - `view`: read-only. Double-click opens the location modal read-only.
        - `locations`: polygon editing, plus a toolbar with add, colour, open and delete.
        - `tiles`: the locations layer is hidden and the mapMaker tooling is shown (palette, brush, tile label and description). Shift + wheel changes the brush size.
    - Autosaves `map.json` about 1 s after the last change. A location's name, description and local characters are saved to `*.location.ts` through the entities API.
- **Timeline** (`pages/Timeline/`)
    - World x = seconds × `pxPerSecond`. The camera is locked at zoom 1 and the wheel changes `pxPerSecond`, so boxes keep a fixed height.
    - Chapter boxes span their `timeRange`. Dragging moves or resizes them, snapped, and saves to `*.chapter.ts`. Their free y goes to `data/chapters/timeline.layout.json`.
    - Triggers are green dots above the strip; dragging one saves its time to `triggers.ts`.
    - Delete asks for confirmation. Double-click opens the chapter view or the trigger modal.
    - The control bar has the character filter, Add (chapter or trigger), and toggles for parent→child arrows and for triggers.
    - Chapters or triggers whose time is code are not drawn; a hint counts them.
- **Chapter view** (`pages/Chapter/`, `#/timeline/chapter/:id`)
    - A Twine-like graph: passage boxes with arrows from statically extracted `passageId` / `nextPassageId`. Pressing a box selects it and drags it in one gesture.
    - Positions are saved to `data/chapters/<ch>/<ch>.layout.json`. Automatic positions are saved only once a box is dragged, so viewing a chapter never writes a file.
    - Links that leave the chapter are dashed ghost boxes: green if the target exists elsewhere, red if it is missing.
    - Toolbar: add or remove a character (the confirmation shows how many passages will be deleted), add passage, chapter info form, delete, open in editor.
    - The passage editor edits every field, with code fields; 422 diagnostics are shown next to their `field` path (e.g. `body.0.links.1.cost`).
    - It shows the passage's image, if any, with an upload button (`components/ImageField.tsx`). The upload is written right away, not with Save.
- **Entities** (`pages/Entities/`): kind menu (characters, locations, npcs, items), a list and a form. Unknown fields and custom data types are edited as code. Save with Ctrl+S. Drafts and the selection live in `ui-state`. Characters and npcs also have an `image` description and their portrait with an upload button (`ImageField`).
- **Structure** tab: disabled, future work. User-defined entity kinds are out of scope.

## Files the Visualizer owns

Besides the `.ts` source it edits, the Visualizer owns these JSON files. They are validated whole-document replaces: an unknown field is a 400. A missing file reads as the default with `version: ''`, and a `PUT` with `version: ''` creates it.

- `data/locations/map.json`: tiles (one run-length-encoded string per row), palette, `tileText` keyed `"<row>,<col>"`, and location polygons keyed by location id in tile-renderer world coordinates. Format: [`Visualizer/README.md`](../Visualizer/README.md#mapjson).
- `data/chapters/timeline.layout.json`: `{ chapters: { [id]: { y } }, triggers: { … } }`.
- `data/chapters/<ch>/<ch>.layout.json`: `{ passages: { [passageId]: { x, y } } }`.

## API

The source of truth is [`Visualizer/protocol/src/routes.ts`](../Visualizer/protocol/src/routes.ts): `ROUTES` holds the paths and `TApiSpec` the body and response of each route. The server registers exactly these routes, and the client builds its URLs from them with `buildPath`.

- Every route is under `/api` and speaks JSON, except `events` (SSE) and `getImageFile` (the PNG bytes).
- A `PUT` or `DELETE` body carries the `version` it was based on; a mismatch answers `409 stale` and writes nothing.
- `PUT` bodies are **partial** (`{ version, ...changedFields }`; an omitted field is left untouched). The map and the two layouts are the exception: their `PUT` replaces the whole document.
- `create*` routes and `addChapterCharacter` answer `201`; everything else answers `200`.
- `:kind` is one of `characters | npcs | locations | items`. `:mapId` is always `global`. `:owner` is one of `passages | characters | npcs`, and its `:id` is a full passage id or an entity id.

| Name                            | Method           | Path                                               |
| ------------------------------- | ---------------- | -------------------------------------------------- |
| `health`                        | `GET`            | `/api/health`                                      |
| `events`                        | `GET`            | `/api/events` (SSE)                                |
| `getProject`                    | `GET`            | `/api/project` (id/title lists of everything)      |
| `createChapter`                 | `POST`           | `/api/chapters`                                    |
| `get/update/deleteChapter`      | `GET/PUT/DELETE` | `/api/chapters/:chapterId`                         |
| `openChapter`                   | `POST`           | `/api/chapters/:chapterId/open`                    |
| `addChapterCharacter`           | `POST`           | `/api/chapters/:chapterId/characters`              |
| `removeChapterCharacter`        | `DELETE`         | `/api/chapters/:chapterId/characters/:characterId` |
| `listChapterPassages`           | `GET`            | `/api/chapters/:chapterId/passages` (with edges)   |
| `createPassage`                 | `POST`           | `/api/chapters/:chapterId/passages`                |
| `get/update/deletePassage`      | `GET/PUT/DELETE` | `/api/passages/:passageId`                         |
| `openPassage`                   | `POST`           | `/api/passages/:passageId/open`                    |
| `createTrigger`                 | `POST`           | `/api/chapters/:chapterId/triggers`                |
| `get/update/deleteTrigger`      | `GET/PUT/DELETE` | `/api/triggers/:triggerId`                         |
| `listEntities` / `createEntity` | `GET/POST`       | `/api/entities/:kind`                              |
| `get/update/deleteEntity`       | `GET/PUT/DELETE` | `/api/entities/:kind/:id`                          |
| `getImage` / `uploadImage`      | `GET/PUT`        | `/api/images/:owner/:id` (`TImageDto`; PNG base64) |
| `getImageFile`                  | `GET`            | `/api/images/:owner/:id/png` (bytes, `ETag`)       |
| `getMap` / `updateMap`          | `GET/PUT`        | `/api/maps/:mapId`                                 |
| `get/updateTimelineLayout`      | `GET/PUT`        | `/api/layout/timeline`                             |
| `get/updateChapterLayout`       | `GET/PUT`        | `/api/layout/chapters/:chapterId`                  |

**Errors** (`dto/errors.ts`): every non-2xx answer is `{ error, message?, diagnostics?, references?, current? }`.

| Status | `error`       | Meaning                                                                            |
| ------ | ------------- | ---------------------------------------------------------------------------------- |
| 400    | `bad_request` | malformed JSON, missing or invalid fields, bad id                                  |
| 404    | `not_found`   | no such route or resource                                                          |
| 409    | `stale`       | `version` is not the one on disk; `current` is the fresh DTO (or `null`)           |
| 409    | `referenced`  | delete refused; `references` lists file, line and text of each reference           |
| 409    | `exists`      | create refused, the id is taken                                                    |
| 422    | `invalid`     | the edit does not type-check (`diagnostics`, with a `field` path); nothing written |
| 500    | `internal`    | bug                                                                                |

**Events** (`dto/events.ts`): `GET /api/events` sends `hello` on connect, then an `event: change` with `{ kind, id, version, op?, chapterId? }` for each change. `kind` is one of `chapter | passage | trigger | entity | map | layout | project`, and `version` is `null` for a deletion. One server operation is one event, however many files it writes. Hand edits are batched over about 150 ms. An id ending in `*` is a wildcard: `trigger` `*` for a hand edit of `triggers.ts`, `entity` `items/*` for an items file.

## Adding or changing a feature

1. **New or changed route**: edit `protocol/src/routes.ts` (`ROUTES` + `TApiSpec`) and the DTOs in `protocol/src/dto/`. Then:
    - add the handler in `server/src/routes/<resource>.ts` (with the reader or writer in `project/`)
    - add the method to `client/src/api/types.ts`, `httpApi.ts` and `mockApi.ts`
    - update the API table above
2. **New editable field**: extend the reader (source → DTO) and the writer's field list. Anything that is not a plain literal must stay `{code}`.
3. **New page**: add a route in `shell/router.ts`, a case in `shell/Shell.tsx`, a tab in `shell/TopBar.tsx`, and a `pages/<Name>/` folder with a MobX store that loads through `api`, subscribes to `apiEvents` and keeps view state in `ui-state`.
4. **Verify**: `yarn typecheck && yarn lint && yarn test`. The test projects are `visualizer-server` (node) and `visualizer-client` (jsdom) in `vitest.workspace.ts`. To try writes against the real server, run it on a copy: `STORY_ROOT=<copy> PORT=<port> yarn dev:visualizer-server`.

## Open items

- A partial `PUT` cannot remove an optional field. The server already accepts `null` for a few fields (character `description`/`startPassageId`, location `sublocations`/`mapId`, linear `nextPassageId`), but the protocol types do not allow it yet.
- `shell/router.ts` defines its own `ENTITY_KINDS`. Its order is the menu order, which differs from the protocol's.
- `server/src/routes/stub.ts` (`notImplemented`) has no callers left.
- `client/index.html` links its favicon from `data/assets`.
- Images are not resources of the event feed: an upload emits no event, and a `.png` added or changed by hand shows up the next time the form or panel is opened.
- Uploads are PNG only (the file picker offers `image/png`, the server checks the signature). There is no conversion, since the server has no image library, and no "remove image".
- There are two `CodeField` components (`components/` and `pages/Entities/`) that could be merged.
- Deleting a chapter's last trigger leaves an empty `triggers.ts`.
- There is no undo, multi-select, map resize or rename, or UI for sub-map links (`maps[]`).
