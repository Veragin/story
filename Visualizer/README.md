# Visualizer

The author's editor for the story: a map, a timeline of chapters and time triggers, a Twine-like view of each chapter's passages, and forms for the entities. It reads and writes the author's own files in `data/` and `types/`, so what you edit here is the story's source code. Spec: [`docs/Visualizer.md`](../docs/Visualizer.md).

## Running it

```bash
yarn dev                        # every service, including both halves of the Visualizer
yarn dev:visualizer-server      # just the server, http://localhost:8123 (tsx watch)
yarn dev:visualizer             # just the client, http://localhost:8101 (Vite)
```

In docker: `make start` runs everything. Or run `make up` and then `make dev-visualizer-server` plus `make dev-visualizer`.

Open http://localhost:8101. The client calls `/api/...` on its own origin, and Vite proxies that to the server. `curl localhost:8123/api/health` (or `localhost:8101/api/health` through the proxy) answers `{"ok":true,...}`.

**Mock mode.** `VITE_VISUALIZER_API=mock yarn dev:visualizer` runs the client on an in-memory implementation of the API (`client/src/api/mockApi.ts`, seed data in `mockData.ts`) with no server. Nothing is saved; this mode is for UI work.

| Env var               | Where  | Default                 | Meaning                                                                                                                                                                                                                                                                               |
| --------------------- | ------ | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `STORY_ROOT`          | server | the repo root           | The project the server reads and writes: a folder with `data/` and `types/`. Point it at a copy to experiment safely. The tests always use a temp copy.                                                                                                                               |
| `VISUALIZER_EDITOR`   | server | `code`                  | The "open in editor" command. `{file}` and `{line}` are substituted (`subl {file}:{line}`, `idea --line {line} {file}`); without placeholders `-g <file>:<line>` is appended. If the editor cannot be started (no `code` inside the container), the client shows `file:line` instead. |
| `PORT`                | server | `8123`                  | Listen port.                                                                                                                                                                                                                                                                          |
| `VISUALIZER_SERVER`   | client | `http://localhost:8123` | Target of the Vite `/api` proxy.                                                                                                                                                                                                                                                      |
| `VITE_VISUALIZER_API` | client | (real server)           | `mock` switches the client to the in-memory API.                                                                                                                                                                                                                                      |

Tests: `yarn test` at the root runs the `visualizer-server` (node) and `visualizer-client` (jsdom) projects from `vitest.workspace.ts`, among the others.

## Layout

```
Visualizer/
  protocol/  @story/visualizer-protocol  the wire contract: ROUTES / TApiSpec (src/routes.ts) and every DTO (src/dto/)
  server/    @story/visualizer-server    node:http on :8123
    src/http/         router (typed from TApiSpec), JSON bodies, HttpError → status mapping
    src/routes/       one file per resource
    src/project/      ts-morph source reader/writer: SourceProject, readers/, writers/, registry, validate, values
    src/json/         map.json and *.layout.json stores, atomic write (tmp + rename)
    src/events/       EventBus (transactions), chokidar watcher, SSE, content-hash versions
    src/open.ts       "open in editor"
  client/    @story/visualizer-client    React + MobX, Vite on :8101
    src/api/          typed client (httpApi), mockApi, ApiError, live events (events.ts)
    src/canvas/       the Canvas library: Scene, Camera, shapes, selection / vertex / line controllers (#/_canvas playground)
    src/shell/        top bar, hash router, control-bar slot, modals, keyboard helper
    src/pages/        Map, Timeline, Chapter, Entities
    src/MapEditor/    the hex tile renderer (ported from mapMaker), used by the Map page
```

Dependencies go one way: client → protocol ← server. The client never imports `@story/data` or `@story/core` at runtime (`eslint.config.js` rejects it); it only has type imports from `@story/types`. The server reads the story as source text and never imports it.

## How the source writer works

- **One long-lived ts-morph `Project`** over `data/` and `types/` (`project/SourceProject.ts`). Each request stats the story files and re-parses only the ones that changed, so hand edits are picked up by the next request. Operations run one at a time.
- **Readers** turn source into DTOs. A field whose initializer is a plain literal comes back as the literal. Anything else (`_('…')`, an expression, a closure) comes back as `{ code }`, its source text verbatim. Trigger `condition`/`action` and link `onFinish` are always code.
- **Writers edit nodes, not files.** A `PUT` is partial: only the fields in the body are touched, and inside a field only the smallest node that changed is replaced (`setInitializer`). `{ code }` is written back verbatim. Comments, other statements in the file and properties the reader does not understand are kept. An unchanged write leaves the file byte-identical.
- **Prettier** formats every changed file with the repo config.
- **In-memory validation.** Before anything touches the disk, the changed project is type-checked in memory (`validate.ts`). If the edit introduces _new_ errors, the answer is `422 invalid` with diagnostics (with a `field` path such as `body.0.links.1.cost` when the error is inside the edited resource), and nothing is written. A `{code}` must be exactly one expression.
- **Versions.** Every DTO has `version`, a content hash of its backing file(s) (a chapter: `<ch>.chapter.ts` + `<ch>.passages.ts`; a trigger: the chapter's `triggers.ts`). A `PUT`/`DELETE` with an old version answers `409 stale` with the current DTO and writes nothing.
- **One transaction = one SSE event.** All files of an operation are written in one `bus.transaction` (each an atomic tmp + rename), which emits exactly one change event. The watcher ignores the server's own writes, so they do not echo back as hand edits.
- **Registry duties** (`project/registry.ts`) keep the hand-maintained indexes in sync:
    - create chapter: `<ch>.chapter.ts`, `<ch>.passages.ts`, plus `register.chapters`, `register.passages` (lazy import) and `TWorldState.chapters`
    - create passage: `<ch>/<character>.passages/<local>.ts` (`export const <local>Passage`), plus the `T<Ch><Char>PassageId` union and the `Record` in `<ch>.passages.ts`
    - add character to chapter: the `<character>.passages/` folder with a start passage (default `intro`) and its id union; remove character is the reverse, including its positions in `<ch>.layout.json`
    - create entity: the entity file, `register.ts` and `TWorldState.ts`
    - delete a passage or an entity: its image (the sibling `.png`) goes too
    - delete is the reverse of create, refused with `409 referenced` (with file, line and text of each reference) while anything still points at the id, including references that would only show up as type errors
- **JSON stores** (`json/`): `data/locations/map.json` and the layouts `data/chapters/timeline.layout.json` and `data/chapters/<ch>/<ch>.layout.json`. They are validated whole-document replaces (400 on a bad shape). A missing file reads as the default with `version: ''`, and a `PUT` with `version: ''` creates it.

### `map.json`

```jsonc
{
    "format": 1,
    "mapId": "global",
    "title": "…",
    "width": 100,
    "height": 100,
    "palette": { "grass": { "name": "Grass", "color": "#3a5" } }, // author's order is kept
    "tiles": ["grass*3 city grass*96", "…"], // one run-length-encoded string per row
    "tileText": { "12,40": { "label": "Mill", "description": "…" } }, // "<row>,<col>"
    "locations": {
        "village": {
            "polygon": [{ "x": 10, "y": 20 }, "…"],
            "fill": "…",
            "stroke": "…",
        },
    },
    "maps": [], // sub-map links: kept as data, no UI
}
```

Painting a tile is a one-line diff. Colour ids may not contain whitespace or `*`. Polygons are in tile-renderer world coordinates (hex renderer at zoom 1). Location keys are sorted. Empty `label`/`description` are dropped.

## Images

The image of a passage, character or npc is the `.png` next to its `.ts` file, with the same basename (`data/chapters/kingdom/annie.passages/palace.ts` → `…/palace.png`, `data/npcs/Franta.ts` → `data/npcs/Franta.png`). The `image` field of a screen passage (and the optional one of a character or npc) is only a text description of it. `server/src/project/images.ts` finds the owner's file like every other route does, so the image follows the file's name.

- `GET /api/images/:owner/:id` (`owner`: `passages | characters | npcs`) answers `TImageDto`: the `.png` path, its content hash as `version` (`''` when there is none) and a cache-busted `url` (`/api/images/:owner/:id/png?v=<version>`) or `null`.
- `GET /api/images/:owner/:id/png` serves the bytes with an `ETag` (`304` on `If-None-Match`).
- `PUT /api/images/:owner/:id` with `{ version, data }` (base64 PNG, at most 10 MB) creates or replaces it; `version: ''` means "there is none yet", a mismatch is `409 stale`. Only PNG is accepted (the signature is checked, nothing is converted).

In the client, `components/ImageField.tsx` shows the image and the upload button in the passage editor and in the character / npc forms. In mock mode uploads live in memory as `data:` URLs.

The game (`SingleEngine/src/images.ts`) finds the same files with `import.meta.glob`, so there too a missing `.png` just means no picture.

## Live refresh

The page never reloads because the story changed. `data/` is not in Vite's module graph, so editing a story file cannot trigger HMR in the Visualizer. Instead:

1. The server watches `data/` and `types/` with chokidar, batches changes over about 150 ms, maps them to resources and sends them on `GET /api/events` (SSE). Its own writes send exactly one event per operation.
2. `client/src/api/events.ts` (`apiEvents.subscribe({ kind, id?, chapterId? }, cb)`) delivers them to the page stores. Events for the client's own saves (same `version`) are filtered out. After a reconnect, `onResync` tells stores to refetch what is on screen.
3. Stores refetch only the changed resource and update it in place. A form with unsaved input for a resource that changed shows "Changed on disk: Reload / Keep mine". The map merges unsaved edits three-way instead.
4. View state (tab, camera, selection, drafts) is kept in `sessionStorage` (`client/src/ui-state.ts`), so a real reload (server restart under `tsx watch`, client code change) loses little.

## Known limitations

- **Protocol**
    - An optional top-level field cannot be removed with a partial `PUT` (omitted = untouched). The server already accepts `null` for `description`/`startPassageId` of a character, `sublocations`/`mapId` of a location and `nextPassageId` of a linear passage, but the protocol types do not allow `null` yet, so the UI offers no "remove".
    - No rename: ids are read-only. Ids must match `/^[a-z][A-Za-z0-9_]*$/`.
    - `open` exists only for chapters and passages.
    - Trigger ids are global (unique across chapters).
    - Hand edits of `triggers.ts` or an items file send a wildcard event (`*`, `items/*`), so the client refetches the whole scope.
- **Source writer**
    - Read-only: passage `type`, `params` and `preamble` (statements before the `return`), `dataType.name`, and anything outside the resource object.
    - Arrays are edited element by element when the length is unchanged. Otherwise the common prefix is kept, so inserting in the middle rewrites the elements after it from the DTO, and comments inside those elements are lost.
    - A `body`, `links` or `timeRange` that is code in the source can be edited as code, but not turned back into a structured list.
    - Moving an item to another type file (for example value → food) is regenerated from the DTO. The Entities page does not offer it.
    - A passage or character created from the UI is unreachable, or has no start passage, until the author wires it up, so `data/test/story.test.ts` flags it until then. That is intended.
    - `SourceProject` stats every story file per request. Switch it to the watcher's file list if the story grows large.
- **UI**
    - No multi-select or box-select, and no undo.
    - The map cannot be resized or renamed from the UI, and sub-map links (`maps[]`) have no UI.
    - Chapter view: automatic positions are only saved once a box is dragged. There is no reordering of body items or links, and `ChapterInfoForm` does not edit `init` or `triggerIds`.
    - Timeline: the wheel zooms time (continuous; there is no slider). Chapters and triggers whose time is code are not drawn (a hint counts them). A stale drag is discarded, not re-applied.
    - Keyboard shortcuts are off while a modal is open.
    - There are two `CodeField` components (`components/CodeField.tsx` and `pages/Entities/CodeField.tsx`) that could be merged.
    - The Structure tab is future work.
