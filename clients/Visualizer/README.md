# Visualizer

The author's editor for the story: a map, a timeline of chapters and time triggers, a Twine-like view of each chapter's passages, and forms for the entities. It holds every story under `stories/` (each behind its password; the landing page lists them) and reads and writes the author's own files in the story's `data/` and `types/`, so what you edit here is the story's source code. Spec: [`docs/Visualizer.md`](../../docs/Visualizer.md). The server (`server/`, NestJS + MySQL) is described in [`docs/Server.md`](../../docs/Server.md).

## Running it

```bash
yarn dev                        # every service, including the server the client needs
yarn dev:visualizer             # just the client, http://localhost:8101 (Vite)
yarn dev:landing-page           # just the landing page (story list), http://localhost:8103 (Vite)
```

In docker: `make start` runs everything. Or run `make up` and then `make dev-server` plus `make dev-visualizer` (and `make dev-landing-page`). Running the server: [`docs/Server.md`](../../docs/Server.md#running-it).

**Landing page** (`clients/LandingPage/`, http://localhost:8103): the list of stories, each with its author, a description toggle and the buttons **Edit** (name, author, description, public, a new password; the map size is read-only), **Open** (the Visualizer, `?story=<id>#/map`), **Play as single** (SingleEngine, `?story=<id>`) and **Export** (the zip). **New story** and **Import** (a zip made by Export, with the same form as New story minus the map size) are at the top. Edit, Open and Export ask for the story's password unless this browser has unlocked it; Play asks only for a story that is not public. The prompt is `PasswordDialog` from `@story/ui`. Like the client, it calls the server through its own `/api` proxy, so the login cookie is shared with the other apps on the same host.

Open a story from the landing page (http://localhost:8103): the client runs on http://localhost:8101/?story=<id>. Without `?story=` it goes back to the landing page; with it, it asks for the story's password when this browser has no grant for it (and again when the 24 h grant expires; Cancel goes back to the story list). The client calls `/api/...` on its own origin, and Vite proxies that to the server. `curl localhost:8123/api/health` (or `localhost:8101/api/health` through the proxy) answers `{"ok":true,...}`.

**Mock mode.** `VITE_VISUALIZER_API=mock yarn dev:visualizer` runs the client on an in-memory implementation of the API (`clients/Visualizer/src/api/mockApi.ts`, seed data in `mockData.ts`) with no server, no login and no `?story=` needed. Nothing is saved; this mode is for UI work.

| Env var               | Where        | Default                 | Meaning                                                                                                                |
| --------------------- | ------------ | ----------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `STORY_SERVER`        | client       | `http://localhost:8123` | Target of the Vite `/api` proxy.                                                                                       |
| `VITE_VISUALIZER_API` | client       | (real server)           | `mock` switches the client to the in-memory API.                                                                       |
| `VITE_LANDING_URL`    | client       | this host, port 8103    | Where the client goes without `?story=`, after a cancelled password prompt, and with "← Stories" (no trailing slash).  |
| `STORY_SERVER`        | landing page | `http://localhost:8123` | Target of the landing page's Vite `/api` proxy.                                                                        |
| `VITE_VISUALIZER_URL` | landing page | this host, port 8101    | Where **Open** goes (no trailing slash): `<url>/?story=<id>#/map`.                                                     |
| `VITE_ENGINE_URL`     | landing page | this host, port 8100    | Where **Play as single** goes (no trailing slash): `<url>/?story=<id>`.                                                |
| `STORIES_ROOT`        | SingleEngine | `stories`               | Where the engine's dev server finds the stories it serves (`vite/storiesPlugin.ts`). Keep it the same as the server's. |
| `STORY_SERVER`        | SingleEngine | `http://localhost:8123` | Target of SingleEngine's Vite `/api` proxy, and the server its story guard asks `GET /api/stories/<id>/access`.        |
| `VITE_LANDING_URL`    | SingleEngine | this host, port 8103    | Where SingleEngine goes without `?story=` or after a cancelled password prompt.                                        |

The server's variables are in [`docs/Server.md`](../../docs/Server.md#environment); the production build variables in [`docs/README.md`](../../docs/README.md#production).

## Layout

```
clients/
  Visualizer/  @story/visualizer-client    React + MobX, Vite on :8101
    src/api/          typed client (httpApi), mockApi, ApiError, live events (events.ts), the story id (story.ts), login (auth.ts)
    src/canvas/       the Canvas library: Scene, Camera, shapes, selection / vertex / line controllers (#/_canvas playground)
    src/shell/        top bar, hash router, control-bar slot, modals, keyboard helper
    src/pages/        Map, Timeline, Chapter, Entities, Structure
    src/stores/       shared stores: StructureStore (literals, types), EntityStore (entity and catalog lists), DraftResource
    src/MapEditor/    the hex tile renderer (ported from mapMaker), used by the Map page
    src/components/   inputs/ (the value inputs and their form/ variants), Notices, FormHeader, SourceEditorDialog (CodeMirror 6)
  LandingPage/ @story/visualizer-landing-page  the story list, React + MobX, Vite on :8103
    src/api.ts        typed client over GLOBAL_ROUTES (+ a story's /info)
    src/StoriesStore.ts  the list, the unlocked flags, requireUnlocked → the password prompt
    src/*Dialog.tsx, StoryList / StoryCard / ImportStoryButton  the UI
protocol/      @story/protocol  the wire contract: STORY_ROUTES / GLOBAL_ROUTES / TApiSpec (src/routes.ts) and every DTO (src/dto/)
```

Dependencies go one way: client → protocol ← server, and landing page → protocol. The client never imports `@story/data` or `@story/core` at runtime (`eslint.config.js` rejects it); it only has type imports from `@story/types`. The server reads the story as source text and never imports it ([`docs/Server.md`](../../docs/Server.md#layout)).

Tests: `yarn test` at the root runs the `visualizer-client` and `visualizer-landing-page` projects (jsdom) from `vitest.workspace.ts`, among the others.

## How the source writer works

- **One long-lived ts-morph `Project` per loaded story** over its `data/` and `types/` (`project/SourceProject.ts`), dropped when the story has been idle for a while (`storyContext/StoryContexts.ts`). Each request stats the story files and re-parses only the ones that changed, so hand edits are picked up by the next request. Operations run one at a time.
- **Readers** turn source into DTOs. A field whose initializer is a plain literal comes back as the literal. Anything else (`_('…')`, an expression, a closure) comes back as `{ code }`, its source text verbatim. Trigger `condition`/`action` and link `onFinish` are always code.
- **Writers edit nodes, not files.** A `PUT` is partial: only the fields in the body are touched, and inside a field only the smallest node that changed is replaced (`setInitializer`). `{ code }` is written back verbatim. Comments, other statements in the file and properties the reader does not understand are kept. An unchanged write leaves the file byte-identical.
- **The source editor is the one exception.** In the chapter view, the code button (toolbar: the selected passage, else the chapter; passage editor: that passage) opens the whole `.ts` file in CodeMirror. `PUT /api/stories/<id>/source/<chapter|passage>/<id>` `{ version, text }` replaces the whole file, but through the same session and commit as every write: prettier, the type check (`422` with diagnostics by line, shown in the editor's gutter), atomic write, one event, `409 stale` ("Changed on disk: Reload / Keep mine"). Only chapter and passage files under `data/` can be reached, by owner and id, never by path. It replaced "open in editor", which cannot work on a server.
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
    - delete is the reverse of create, refused with `409 referenced` (with file, line and text of each reference) while anything still points at the id, including references that would only show up as type errors. Deleting an entity or a catalog entry clears the values that point at it instead (optional key removed, array element removed, required field set to the first remaining id) and is refused only by code references or a required field with no id left; `GET …/references` previews it
    - create type: `types/<Name>.ts` and its line in `types/index.ts`; a catalog type also `data/catalogs/<plural>.ts` and `T<Name>Id`. Editing a type rewrites its instances in the same commit (renames, removed keys, defaults for new required fields)
- **JSON stores** (`json/`): `data/locations/map.json` and the layouts `data/chapters/timeline.layout.json` and `data/chapters/<ch>/<ch>.layout.json`. They are validated whole-document replaces (400 on a bad shape). A missing file reads as the default with `version: ''` (for the map: an empty map of the story's `mapSize`), and a `PUT` with `version: ''` creates it.

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

- `GET /api/stories/:storyId/images/:owner/:id` (`owner`: `passages | characters | npcs`) answers `TImageDto`: the `.png` path, its content hash as `version` (`''` when there is none) and a cache-busted `url` (`/api/stories/:storyId/images/:owner/:id/png?v=<version>`) or `null`.
- `GET …/images/:owner/:id/png` serves the bytes with an `ETag` (`304` on `If-None-Match`).
- `PUT …/images/:owner/:id` with `{ version, data }` (base64 PNG, at most 10 MB) creates or replaces it; `version: ''` means "there is none yet", a mismatch is `409 stale`. Only PNG is accepted (the signature is checked, nothing is converted).

In the client, `clients/Visualizer/src/components/inputs/ImageInput.tsx` shows the image and the upload button in the passage editor and in the character / npc forms. In mock mode uploads live in memory as `data:` URLs.

The game finds the same files: the story's virtual module lists every `.png` under its `data/` (`clients/SingleEngine/vite/storiesPlugin.ts`, read by `clients/SingleEngine/src/images.ts`), so there too a missing `.png` just means no picture.

## Live refresh

The page never reloads because the story changed. `data/` is not in Vite's module graph, so editing a story file cannot trigger HMR in the Visualizer. Instead:

1. For each loaded story, the server watches its `data/` and `types/` with chokidar, batches changes over about 150 ms, maps them to resources and sends them on that story's `GET /api/stories/:storyId/events` (SSE). Its own writes send exactly one event per operation.
2. `clients/Visualizer/src/api/events.ts` (`apiEvents.subscribe({ kind, id?, chapterId? }, cb)`) delivers them to the page stores. Events for the client's own saves (same `version`) are filtered out. After a reconnect, `onResync` tells stores to refetch what is on screen.
3. Stores refetch only the changed resource and update it in place. A form with unsaved input for a resource that changed shows "Changed on disk: Reload / Keep mine". The map merges unsaved edits three-way instead.
4. View state (tab, camera, selection, drafts) is kept in `sessionStorage` (`clients/Visualizer/src/ui-state.ts`), keyed by story, so a real reload (server restart in `yarn dev`, client code change) loses little.
5. The event stream needs the story's grant too. When the browser gives up on it (an `EventSource` cannot see the `401`), the client probes with `GET /info`, which asks for the password on a 401, and re-creates the stream right after the login.

## Known limitations

- **Protocol**
    - An omitted field in a partial `PUT` is untouched; `null` removes an optional one (any optional entity field, a key of `userFields`, a linear passage's `nextPassageId`). The Entities form uses it, but the protocol body types do not model `null` yet.
    - No rename: ids are read-only. Ids must match `/^[a-z][A-Za-z0-9_]*$/`.
    - The source editor exists only for chapters and passages (`/source/chapter/<id>`, `/source/passage/<id>`).
    - Trigger ids are global (unique across chapters).
    - Hand edits of `triggers.ts`, an items file or a catalog file send a wildcard event (`*`, `items/*`, `races/*`), so the client refetches the whole scope.
- **Source writer**
    - Read-only: passage `type`, `params` and `preamble` (statements before the `return`), `dataType.name`, and anything outside the resource object.
    - Arrays are edited element by element when the length is unchanged. Otherwise the common prefix is kept, so inserting in the middle rewrites the elements after it from the DTO, and comments inside those elements are lost.
    - A `body`, `links` or `timeRange` that is code in the source can be edited as code, but not turned back into a structured list.
    - Moving an item to another type file (for example value → food, by changing its type) is regenerated from the DTO.
    - A passage or character created from the UI is unreachable, or has no start passage, until the author wires it up, so `data/__tests__/story.test.ts` flags it until then. That is intended.
    - `SourceProject` stats every story file per request. Switch it to the watcher's file list if the story grows large.
- **UI**
    - No multi-select or box-select, and no undo.
    - The map cannot be resized or renamed from the UI, and sub-map links (`maps[]`) have no UI.
    - Chapter view: automatic positions are only saved once a box is dragged. There is no reordering of body items or links, and `ChapterInfoForm` does not edit `triggerIds`.
    - Timeline: the wheel zooms time (continuous; there is no slider). Chapters and triggers whose time is code are not drawn (a hint counts them). A stale drag is discarded, not re-applied.
    - Keyboard shortcuts are off while a modal is open.
    - Structure tab: a type or literal draft is not kept across a reload, and switching the selection drops it without asking.
    - A catalog type cannot reach its own ids through its fields (`TRace.kin: TRaceId[]`): tsc would turn `TRaceId` into `any`, so the server refuses it.
