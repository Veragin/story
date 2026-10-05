# Visualizer

The author's editor for the story. It shows a hex map with location polygons, a timeline of chapters and time triggers, a Twine-like graph of each chapter's passages, and forms for the entities. It holds every story of the installation (`stories/<id>/`, see [`docs/README.md`](README.md#stories)), each behind its password, and **reads and writes the story's own source files** in its `data/` and `types/`, so every edit in the UI is an edit to TypeScript source that the author also edits by hand.

How to run it, the env vars, the `map.json` format and the full list of known limitations are in [`Visualizer/README.md`](../Visualizer/README.md). This file covers what you need to understand and change the service.

## Architecture

Four yarn workspaces. Dependencies go one way: **client → protocol ← server**, and **landing-page → protocol**.

| Workspace                        | Path                       | What it is                                                                                                                       |
| -------------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `@story/visualizer-protocol`     | `Visualizer/protocol/`     | The wire contract: `STORY_ROUTES` / `GLOBAL_ROUTES` + `TApiSpec` (`src/routes.ts`) and all DTOs (`src/dto/`)                     |
| `@story/visualizer-server`       | `Visualizer/server/`       | `node:http` on **:8123** (`tsx watch`). Reads and writes story source with ts-morph                                              |
| `@story/visualizer-client`       | `Visualizer/client/`       | React + MobX + MUI, Vite on **:8101**. Vite proxies `/api` to the server                                                         |
| `@story/visualizer-landing-page` | `Visualizer/landing-page/` | The story list (create, edit, open, play, export, import). React + MobX + MUI, Vite on **:8103**, `/api` proxied like the client |

Hard rules (enforced by `eslint.config.js`, check with `yarn lint`):

- The **client never imports `@story/data` or `@story/core` at runtime**; only type imports from `@story/types`. All story data comes from the server. This is also what keeps Vite from reloading the page when a story file changes.
- The **server never imports the story**; it parses it as source text.
- The **landing page imports only `@story/visualizer-protocol`, `@story/ui` and `@story/shared`**: no story, no other Visualizer app. Its password prompt is `PasswordDialog` from `@story/ui`, shared with the client and SingleEngine.
- `protocol` imports no service code. `data/` and `types/` never import any service.

## Server (`Visualizer/server/src/`)

```
index.ts, app.ts, context.ts   startup; TServerContext = { router, project, bus }
http/        typed router (from TApiSpec), JSON body parsing, HttpError → status
routes/      one file per resource; routes/index.ts registers them, app.ts asserts none is missing
project/     ts-morph source layer
  ProjectRoot.ts     one story's dir (STORIES_ROOT/<id>) and `paths` of every well-known file
  SourceProject.ts   one long-lived ts-morph Project; run() serialises ops; session() → commit()
  readers/           source → DTO (structure.ts: literals, types, catalogs; catalogs.ts: catalog entries)
  writers/           DTO → minimal AST edits (and source.ts: the source editor's whole-file save);
                     structure.ts / literals.ts / catalogs.ts write the Structure tab and catalog entries
  values.ts          literal ⇄ {code} conversion, Time/TimeRange/DeltaTime, refs
  registry.ts        keeps register.ts, TWorldState.ts, <ch>.passages.ts in sync; reference search
  validate.ts        in-memory type check, diagnostics with DTO field paths
  objectCatalog.ts   the "object of objects" helpers shared by items and catalogs (one entry per key)
  typeInstances.ts   every value typed by a type (entities, init objects, items, catalog entries) + migrateInstance
  clearReferences.ts delete of an entity or a catalog entry: clears the values that point at it
  migrations/        structureLayout.ts: moves an older story to the structure layout (types/literals.ts, TNpc.ts, TItemInfo), on its first load
json/        map.json and *.layout.json stores (validated whole-document replace)
events/      EventBus (transactions), chokidar watcher, pathToEvent, SSE, version hashing
auth/        password.ts (scrypt), SessionStore (in-memory grants), cookie, csrf, LoginLimiter
stories/     StoryStore (story.json), StoryContexts (loaded stories), access.ts (the grant check),
             storyFolders.ts (create from the template, import), storyInput.ts (body checks), zip.ts
```

`Visualizer/server/template/` is not server code: it is the story that "create story" copies (`data/` and `types/`; one chapter `start`, character `hero` with an `intro` passage, location `home`, npc `stranger`, item `gold`). It is the smallest story that type-checks: with no npc or no item, the id unions collapse to `never` and the engine's types break. It has its own `tsconfig.json`, and `yarn typecheck` checks it with the stories (`scripts/typecheck-stories.mjs`); `eslint.config.js` lints it with a story's zones. A new story gets its own `tsconfig.json`, written for its folder (`storyTsconfig`), because the engine paths in it are relative.

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
    - The one intended exception is the source editor (`PUT /source/:owner/:id`, `project/writers/source.ts`): the author edits a chapter or passage file as text, so the whole text is replaced. It still goes through `session()` → `commit()` (prettier, the type check with `422` diagnostics by line, atomic write, one event: `chapter` or `passage`, `409 stale`). Its file is found by owner and id only (`chapterFile` / `findPassageFile` in `project/story.ts`) and must be a `.ts` under `data/` (not `data/__tests__/` or `data/assets/`); a syntax error is answered with its own line and column before prettier runs.
- **Code fields.** An initializer that is not a plain literal (`_('…')`, expressions, closures) is read as `TCode = { code: string }` and written back verbatim. Described functions (passage `execute`, link `onFinish`, body item `condition`, trigger `condition`/`action`) are always code and read as `TFunctionDto = { code, description? }` (schema `S.fn` in `values.ts`): `code` is the whole initializer, `description` the `/** … */` JSDoc directly above the property. Writers edit the comment as text (`jsDocEdit` / `applyTextEdits` in `ast.ts`, queued until the end of `applyPartial` because a text edit forgets the file's nodes); `*/` is escaped, several lines become `*` lines, and a description with empty code gets a default (`() => {}`, `true` for a body condition). A `{code}` must be exactly one expression.
- **Versions.** Every DTO carries `version`, a content hash of its backing files: a chapter is `<ch>.chapter.ts` + `<ch>.passages.ts`, and a trigger is its chapter's `triggers.ts`. So creating or deleting a passage or trigger changes the chapter's version too.
- **Always write through `tx.writeFile`** (or `commit`), never `sourceFile.save()`. That way the watcher does not echo the server's own writes back as hand edits.
- **Registry duties.** Creating or deleting a resource also updates the files that index it by hand:
    - chapter: `<ch>.chapter.ts`, `<ch>.passages.ts`, `register.chapters`, `register.passages` (lazy import), `TWorldState.chapters`
    - passage: `<ch>/<character>.passages/<local>.ts` (`export const <local>Passage`), plus the `T<Ch><Char>PassageId` union and the `Record` in `<ch>.passages.ts`
    - character added to a chapter: the `<character>.passages/` folder with a start passage (default `intro`) and its id union. Removing the character reverses all of this, including its positions in `<ch>.layout.json`.
    - entity: its file, `register.ts`, `TWorldState.ts`. Items live in `data/items/itemInfo.ts` / `foodInfo.ts` / `toolInfo.ts`, chosen by `type` (food, tool, else itemInfo). Changing the type moves the item.
    - trigger: `triggers.ts` and the chapter's `triggers: [...]`
    - type: `types/<Name>.ts` and its `export *` line in `types/index.ts`; a catalog type also gets `data/catalogs/<plural>.ts` and `T<Name>Id`
    - catalog entry: one property of the catalog object (like an item)
    - delete reverses create. It is refused with `409 referenced` while anything still points at the id, including references that would only appear as type errors. Entities and catalog entries are the exception, see **Deleting a referenced instance** below.
- **Structure writes** (`writers/structure.ts`, `writers/literals.ts`): `updateType` edits the type's members in place (the engine members of an extendable type stay byte-for-byte) and, in the same session, rewrites every instance (`typeInstances.ts`): renames, removed keys, `typeDefault` for a new required key, and with `resetIncompatible` the values of fields whose type changed. The response lists the `touchedFiles`. A literal value rename rewrites the values typed by that literal (found through the type checker); removing a used value, or deleting a used type or literal, is `409 referenced`. Extendable and engine types cannot be deleted (`403`). `addLiteralValue` is the one write an entity form makes outside its entity; it commits at once, so discarding the form keeps the value.
- **Deleting a referenced instance** (`project/clearReferences.ts`, shared by `deleteEntity` and `deleteCatalogEntry`): in the same session as the delete, every value typed `ref` to it (entity fields, `init`, items, catalog entries, chapter `location` and `init`, `sublocations`, inventories) is cleared: an optional field loses its key, an array element (`sublocations`, an inventory entry `{ id }`) is removed, a required field gets the first remaining id, and a required field with no id left refuses the delete. Code references (imports, a character's chapter files, ids inside code) still refuse it with `409 referenced`. The answer lists the `cleared` values (`TClearedReferenceDto`: resource, path, `removed` or the new value), and each touched resource gets its own `updated` event. `GET …/references` is the same delete as a dry run (`s.check()` then rollback), for the confirmation dialog.
- Hand edits are picked up on the next request: `SourceProject` stats the story files and re-parses only the changed ones.
- Tests never touch the real `stories/`: `__tests__/helpers.ts#makeTempStories(ids)` copies the example story (`data/`, `types/`, `story.json`, `tsconfig.json`) under each id into a temp `STORIES_ROOT` (`makeTempProject()` is the one-story shorthand), `createApp({ storiesRoot, watch: false })` runs on it, and `login(base, storyId)` returns the cookie of a grant (the example's password is `example`).

### Story file conventions the server relies on

- Passage id = `<chapter>-<character>-<local>`, so **ids never contain `-`**. Every id (chapter, character, npc, location, item, trigger, passage local id) matches `/^[a-z][A-Za-z0-9_]*$/` and is read-only (no rename). Ids become export names (`<id>Chapter`, `<local>Passage`, …).
- **A chapter's characters are the `<character>.passages/` folders in the chapter's folder**; `TChapter` has no list of them.
- Trigger ids are global (unique across chapters).
- Location geometry lives in `data/locations/map.json`, not in `*.location.ts`.
- **Story art is found by convention**: the image of a passage, character or npc is the `.png` next to its `.ts` file, with the same basename (`annie.passages/palace.ts` → `annie.passages/palace.png`, `npcs/Franta.ts` → `npcs/Franta.png`). The owner's `image` field is only a text description. `project/images.ts` resolves the owner's file the way every other route does; deleting a passage or entity deletes its `.png`. `data/assets/story.png` is only the apps' favicon.
- **Structure** (`project/readers/structure.ts`, `GET /structure`):
    - **Literals** are string-literal unions (`type TMood = 'calm' | 'angry'`). Global ones live in `types/literals.ts`; a local one is declared in the file that uses it (`TItemType` in `data/items/itemInfo.ts`). A name is unique across the story; a second declaration is ignored with a structure diagnostic. Aliases named `T*Id` are never literals.
    - **Types**: every story type has its own `types/<Name>.ts`, re-exported from `types/index.ts`. `TCharacter` / `TCharacterData` (`types/TCharacter.ts`), `TNpc` / `TNpcData` (`types/TNpc.ts`), `TLocation` and `TItemInfo` are **extendable**: the engine's members are locked, the author adds their own (`EXTENDABLE_FIELDS`). Other engine types are read-only, and generic or unparsable types are shown as their code.
    - `TItemInfo` (`name`, `type`, then the author's fields) is declared in `data/items/itemInfo.ts`, next to the item objects, which use `as const satisfies Record<string, TItemInfo & Record<string, unknown>>` (free props stay allowed). `types/TItem.ts` exports `TInitInventory`.
    - **Catalogs** are the instances of a story type: `data/catalogs/<plural>.ts` exports `<plural> = { <id>: { … } } satisfies Record<string, T<Name>>`, and the type file adds `T<Name>Id = keyof typeof <plural>` (with `import type`, so the `types` ⇄ `data/catalogs` cycle stays type-only). A field typed `T<Name>Id` is a `ref` to it, like `TLocationId` or `TItemId`.
    - **No id cycle**: a catalog type must not reach its own ids through `ref` fields (`TRace.kin: TRaceId[]`, or `TRace → TClan → TRaceId`, or through `TItem`, whose ids come from `itemInfo`). tsc turns such an id type into `any`, so `createType` / `updateType` refuse it with `422` (`writers/idCycles.ts`). Plain type-name cycles are fine.
- `data/__tests__/story.test.ts` flags unreachable passages and characters without a start passage. Passages and characters created from the UI trip it until the author wires them up. That is intended; the server does not refuse those writes.

## Client (`Visualizer/client/src/`)

```
api/        the only way to reach story data: `api` (httpApi or mockApi), `apiEvents`, ApiError,
            `STORY_ID` (story.ts, from `?story=`), `auth` (auth.ts, the 401 → password prompt flow)
canvas/     the Canvas library: Scene, Camera, shapes, controllers (playground at #/_canvas)
shell/      TopBar with tabs, hash router, <ControlBar> slot, modal host, keyboard helper
pages/      Map, Timeline, Chapter, Entities, Structure (each has a MobX store + components + __tests__/)
stores/     the shared stores: StructureStore, EntityStore, DraftResource, writeResult (singletons in context.ts)
MapEditor/  hex tile renderer ported from mapMaker, used by the Map page
components/ inputs/ (the value inputs, below), FormHeader, Notices, formLayout, ResizableSplitter,
            SourceEditorDialog (CodeMirror, openSourceEditor)
ui-state.ts sessionStorage view state (getUiState / setUiState / useUiState), try/catch safe, keyed by story
theme.ts    the single dark MUI theme
```

- **The story** (`api/story.ts`): the client edits the story in `?story=<id>` (the landing page's **Open** puts it there), read once at load. Without it `main.tsx` goes to the landing page (`VITE_LANDING_URL`, default this host on :8103). Every story call, the event stream and the `ui-state` keys (`visualizer:<id>:…`) use it; the mock ignores it. The top bar shows the story's name (`GET /info`, `shell/storyInfoStore.ts`) and a "← Stories" link to the landing page.
- **Login** (`api/auth.ts`, `shell/LoginPrompt.tsx`): a `401` on any request opens `PasswordDialog` from `@story/ui`; the request waits, and is retried once after the login (`httpApi`'s `onUnauthorized`). Requests that 401 while the prompt is open wait on the same prompt. Cancel goes back to the landing page. An `EventSource` cannot see a 401 (the browser just gives up on the stream), so `apiEvents` calls `onGiveUp` when it does, which probes with `GET /info` (and so opens the prompt on a 401); after the login `apiEvents.reconnectNow()` re-creates the stream, and its `hello` fires `onResync`.
- **Routing** (`shell/router.ts`): `#/map`, `#/timeline`, `#/timeline/chapter/:chapterId`, `#/entities[/:kind[/:id]]`, `#/entities/catalogs/:catalog[/:id]`, `#/structure[/types|literals[/:name]]`, `#/_canvas`, `#/_inputs` (the inputs playground). `shell/Shell.tsx` switches pages on `route.page`.
- **Shared stores** (`client/src/context.ts`): `structureStore` (`StructureStore`: literals, types, `fieldsOf(typeName, dataType?)`, `refOptions(refName)`, the structure writes as `TWriteResult` = ok / invalid / referenced / stale / exists / error) and `entityStore` (`EntityStore`: lists of every kind and catalog, `optionsOf(refTarget)`, CRUD, delete previews). `store.start()` returns a release and subscribes to events only while someone holds it (`RefCountedSubscription`). `DraftResource` is the draft / stale / save / Keep mine / delete logic of one form, used by the entity, catalog entry and structure forms; a version change that leaves the form's fields equal (our own `addLiteralValue`, a sibling item in the same file) rebases silently instead of going stale.
- **Control bar**: a page renders `<ControlBar>…</ControlBar>` anywhere in its tree, and the children are portalled into the top bar. Use at most one per page.
- **Modals**: `modals` from `shell/modals.ts` (`modals.confirm`, `modals.open`). **Keyboard**: `keyboard` / `useKey` from `shell/keyboard.ts`. Keys are ignored while an input is focused or a modal is open, unless the handler passes `allowInModal`.
- **API usage**: `import { api, apiEvents, ApiError } from '../api'`. Mutations return the new DTO; keep its `version` for the next `PUT`. For live refresh, use `apiEvents.subscribe({ kind, id?, chapterId? }, cb)`, plus `apiEvents.onResync(cb)` to refetch after a reconnect. The client's own saves are filtered out automatically. Stores that hold lists subscribe to `kind: '*'` and refetch on `op: 'created' | 'deleted'`.
- **Mock mode**: `VITE_VISUALIZER_API=mock` runs on `api/mockApi.ts` (seed data in `mockData.ts`) with no server, no login and the story id `example` when there is no `?story=`. Tests use `createMockApi({ seed?, events? })` and `simulateExternalChange(kind, id)`. When you add or change an API method, update `api/types.ts`, `httpApi.ts` **and** `mockApi.ts`.
- **Conflict UX**: a form with unsaved input whose resource changed on disk shows "Changed on disk: Reload / Keep mine". "Keep mine" re-sends with the new version. The source editor does the same. A source save is deliberately **not** marked as an own save (`NOT_MARKED_SAVED` in `httpApi.ts`), so the forms and the graph get its event like a hand edit's. The map merges three-way instead (`pages/Map/mergeMap.ts`). Timeline drags that answer `409 stale` are discarded, not re-applied.
- **Inputs** (`components/inputs/`): every form edits its values through these. A pure input has no label and takes `TInputProps` (`value`, `onChange`, `ariaLabel`, `hasError?`, `disabled?`, `dataField?`); its form variant in `inputs/form/` (`FormStringInput`, `FormNumberInput`, `FormBooleanInput`, `FormLiteralInput`, `FormTypeInput`, `FormArrayInput`, `FormObjectInput`, `FormValueInput`, `FormStructureInput`, `FormFunctionInput`, `FormImageInput`, `FormDataTypeInput`) wraps it in `FormLabel`: the label beside the input (above it on narrow screens), diagnostics, `helperText` / `warning`, `actions`, and for `optional` fields "+ label" / a remove button (`onChange(undefined)` removes the key). `dataField` is the diagnostic path, so tests and the browser can find a field.
    - Scalars: `StringInput` (single line or `multiline`), `NumberInput`, `BooleanInput`. Their value is `T | TCode`, but they do **not** edit code: a value that is code (`_('…')`, an expression) is shown read-only by `CodeValue`, with **Convert** when it parses as a plain value (`codeToText`, `parsePlainValue`) or **Reset** to a default otherwise.
    - `LiteralInput` (MUI Autocomplete over a literal's values; with `onCreateOption`, "+ Add x" writes the new value at once through `addLiteralValue`) and `TypeInput` (picks an id of a referenceable type: entities, chapters, catalog entries).
    - `ArrayInput` (add, move, remove, optional `itemType` and `newItem`) and `ObjectInput` (`{ key: value }` with an **Inputs ⇄ Code** toggle; the code view is validated, `objectValidation.ts`). With `fields` it shows one input per field (optional ones can be added and removed); without, or with `allowCustomFields`, the author can add a key and pick its type.
    - `ValueInput` picks the input for a `TTypeRef` (`string`, `number`, `boolean`, `literal`, `ref`, `array`, `object`, `function`, `code` read-only). `StructureInput` edits a type's fields (key, type via `FieldTypePicker`, optional, description; locked engine fields read-only), keeps renames (`rowRenames`) and lets the author declare a new local literal while picking a field's type.
    - `FunctionInput` edits a **described function** (`TFunctionDto`: passage `execute`, link `onFinish`, body item `condition`, trigger `condition` / `action`): a **Code ⇄ Description** toggle (it starts on the description when there is one), the whole initializer in the code view and the JSDoc text in the description view. Both values are kept while switching, a dot on the other view's button marks it as empty, clearing the description drops the key (and the comment on Save), and the code's diagnostics show in both views. `FormFunctionInput`'s `emptyCode` is the code of a new value.
    - `valueSource.ts`: `TValue` ⇄ source text (`valueToSource`, `parseValueSource`), the guards (`isString`, `isTextRecord`, `isArrayOf`, …) and `toMaybeCode(value, guard)`, which turns an input's `TValue` back into a DTO field (anything that does not fit becomes code).
    - **`StructureContext`** (`structureContext.ts`): `literalValues`, `refOptions`, `addLiteralValue`, the literal and type names. `Shell` provides `structureStore`; a dialog outside the shell provides it itself, tests use `staticStructureContext(structure, options)`, and `withoutRefOption` hides one id (a location is never its own sublocation). Any `ValueInput`, `ArrayInput`, `ObjectInput`, `LiteralInput` or `StructureInput` needs it. `useTypeContext()` gives the `TTypeDefaultContext` for `typeDefault` (the default of a new required value: `''`, `0`, `false`, the first literal value or id).
- **Images** (`components/inputs/ImageInput.tsx`): the shared image component of a passage, character or npc. With an image it shows only the picture; overlay buttons in its top-right corner (on hover, on keyboard focus and always on touch devices) replace it or switch the frame to the `image` description and back. Without an image it shows the description (a multiline text field) and an **Upload image** button. PNG only, up to `MAX_IMAGE_BYTES`; a `409 stale` shows the image on disk and asks to upload again, and a late response for another owner is dropped. A description that is code (`_('…')`) is shown read-only with **Convert to text**. The upload is written right away; the description is part of the draft and is written on Save (the tooltip next to the label says so).
- **Style**: MobX stores, `@story/ui` primitives, MUI `styled`, 4-space prettier, `_()` for user-facing strings where the surrounding code uses it.

### Canvas library (`canvas/`)

- `Scene` owns the canvas, a `Camera` (`{x, y, zoom}`, `screen = (world − {x,y}) × zoom`), layers and an on-demand render loop. Call `destroy()` to remove every listener and loop. Camera input: WASD/arrows, drag and wheel zoom.
- Shapes: `RectShape`, `PolygonShape`, `LineShape` (optionally anchored to shapes, with an optional arrowhead) and `TextShape`, each with `fill`, `stroke` and `zIndex`. A custom shape extends `Shape`.
- Controllers:
    - `SelectionController`: click selects. Only an already-selected shape can be dragged; dragging an unselected one pans.
    - `VertexEditController`: drag vertices, double-click an edge to insert one, right-click a vertex to remove it (minimum 3).
    - `LineTool`: places a line between two points.
- Double-click fires the shape's `action`. With `scene.editable = false` nothing can be edited or selected.
- In tests, jsdom has no `PointerEvent`: dispatch `MouseEvent`s named `pointerdown` etc. (`canvas/__tests__/helpers.ts`). `canvas/__tests__/setup.ts` stubs `getContext`.

## Landing page (`Visualizer/landing-page/src/`)

The story list and the way into every story: http://localhost:8103 in dev, `/` in production. It talks to the server only through `GLOBAL_ROUTES` plus a story's `/info` (`api.ts`).

- `StoriesStore.ts`: the list (`GET /api/stories`, with each story's `unlocked` flag) and `requireUnlocked(id)`, which returns at once for an unlocked story and otherwise opens `PasswordDialog` and logs in.
- `StoryList.tsx` / `StoryCard.tsx`: name, author in grey, a description toggle, and the buttons **Edit** (`EditStoryDialog`: name, author, description, public, an optional new password; the map size is read-only, plan D6), **Open** (`<VITE_VISUALIZER_URL>/?story=<id>#/map`), **Play as single** (`<VITE_ENGINE_URL>/?story=<id>`) and **Export** (navigates to `/api/stories/<id>/export`). Edit, Open and Export go through `requireUnlocked`; Play only when the story is not `public`. The target URLs are in `links.ts`.
- `CreateStoryDialog.tsx` (name, author, password twice, description, map size, public; `storyForm.ts` checks the fields against `STORY_LIMITS`) and `ImportStoryButton.tsx` (a file picker; `409 exists` asks for another id).
- It never runs a story, and it keeps no state of its own besides the list: the grant is the `story_session` cookie, which the other apps on the same host share.

## Pages

Behaviour that is settled (keep it unless the user asks otherwise):

- **Map** (`pages/Map/`, `MapEditor/`)
    - Two stacked canvases share one `Camera`: the hex tiles (`MapEditor/MapEngine/Draw.ts`) and the Locations `Scene` on top (`LocationsLayer.ts`). The Locations scene owns WASD/arrow input in every mode; in tiles mode its canvas is click-through.
    - Modes:
        - `view`: read-only. Double-click opens the location modal read-only.
        - `locations`: polygon editing, plus a toolbar with add, colour, open and delete.
        - `tiles`: the locations layer is hidden and the mapMaker tooling is shown (palette, brush, tile label and description). Shift + wheel changes the brush size.
    - Autosaves `map.json` about 1 s after the last change. A location's name, description and local characters are saved to `*.location.ts` through the entities API (`LocationForm`: `FormStringInput`s and a `FormArrayInput` of `{ name, description }`, `LOCAL_CHARACTER_TYPE` in `typeRefs.ts`, shared with the Entities location form).
- **Timeline** (`pages/Timeline/`)
    - World x = seconds × `pxPerSecond`. The camera is locked at zoom 1 and the wheel changes `pxPerSecond`, so boxes keep a fixed height.
    - Chapter boxes span their `timeRange`. Dragging moves or resizes them, snapped, and saves to `*.chapter.ts`. Their free y goes to `data/chapters/timeline.layout.json`.
    - Triggers are green dots above the strip; dragging one saves its time to `triggers.ts`.
    - Delete asks for confirmation. Double-click opens the chapter view or the trigger modal (`TriggerModal`: name and description, only the changed ones are sent).
    - The control bar has the character filter, Add (chapter or trigger: an id, then the location or the chapter as a `FormTypeInput`), and toggles for parent→child arrows and for triggers.
    - Chapters or triggers whose time is code are not drawn; a hint counts them.
- **Chapter view** (`pages/Chapter/`, `#/timeline/chapter/:id`)
    - A Twine-like graph: passage boxes with arrows from statically extracted `passageId` / `nextPassageId`. Pressing a box selects it and drags it in one gesture.
    - Positions are saved to `data/chapters/<ch>/<ch>.layout.json`. Automatic positions are saved only once a box is dragged, so viewing a chapter never writes a file.
    - Links that leave the chapter are dashed ghost boxes: green if the target exists elsewhere, red if it is missing.
    - Toolbar: add or remove a character (the confirmation shows how many passages will be deleted), add passage, chapter info form, delete, edit source (the selected passage's file, else the chapter's).
    - **Chapter info** (`ChapterInfoForm/`): title, description, location, time range (`TimeRangeInput`; a `Time.fromString` endpoint, a whole range in code stays an editable code block), children (`{ chapterId, condition }`, never the chapter itself), `init` as a `FormObjectInput` over the chapter's data type, and the data type itself (`FormDataTypeInput`). Editing the data type moves `init` along (`migrateInit`: renames, removed keys, defaults of new required fields).
    - **Source editor** (`components/SourceEditorDialog.tsx`, store `SourceEditorStore.ts`): the whole `.ts` file in CodeMirror 6, opened from that toolbar button and from the passage editor's code button. Save or Ctrl+S sends the whole text; `422` diagnostics in the file are marked in the lint gutter beside their lines (ones in other files are listed above), `409 stale` or a change on disk under unsaved input shows "Changed on disk: Reload / Keep mine", a change on disk with no unsaved input replaces the text. The dialog (and CodeMirror) is loaded lazily on first use.
    - The passage editor (`editor/PassageEditor/`) edits every field; 422 diagnostics are shown next to their `field` path (e.g. `body.0.links.1.cost`). A screen passage shows its title, its image and description (`ImageInput`; the upload is written right away, not with Save), **Execute** (`ExecuteField`, a `FunctionInput`) and the Body. Linear and transition passages show Execute at the top of their fields. While the passage function has statements before its `return` (`preamble`), a note under Execute says they are kept.
    - Fields: strings are `FormStringInput`, passage targets (link, redirect, linear / transition next) `FormTypeInput` (a transition offers the same character's passages in the other chapters, `ChapterGraphStore.transitionOptions`), auto priority `FormNumberInput`. Each has `dataField` = its diagnostic path. **Cost** (`editor/CostField/`): time only (minutes) or `{ time, items, tools }` with items and tools as lists; a cost that is code is shown read-only (Convert / Reset to 10 min).
    - Body items: condition (`FunctionInput`, `true` when added), redirect, text and links. Each link is one line (`LinkSummary`): its text, then `passageId (1 min) (2 Bread) [Knife]` in gray as SingleEngine shows it (`linkSummary.ts`, times by `formatDelta` in `costCode.ts`, item and tool names from the item options), code-valued parts as `ƒ` with the code as tooltip. The expand button opens the full `LinkEditor` (text, target, auto priority, cost, `onFinish`). The open state is local, keyed by index; a new link starts open and a link with diagnostics is always open.
- **Entities** (`pages/Entities/`): kind menu (characters, locations, npcs, items, then one tab per catalog, e.g. **Races** at `#/entities/catalogs/races`), a list (`ResourceList`) and a form. Save with Ctrl+S. Drafts and the selection live in `ui-state`. Characters and npcs also have their portrait and its `image` description (`ImageInput`).
    - `EntityForm` (`EntityFormStore` over a `DraftResource`): the engine fields, then the author's fields of the type (`UserFieldsInput`, sent as `userFields`), `init` as a `FormObjectInput` over `TCharacterData` / `TNpcData` plus the entity's own data type (`InitInput`), and the data type itself as a `StructureInput` (`DataTypeInput`; the server writes it from `fields` and adds the imports). Removing an optional field sends `null`.
    - Items: `name`, `type` (a `LiteralInput` over the local `TItemType`; "+ Add" writes the new value into `itemInfo.ts` at once), the author's `TItemInfo` fields, then free props. Changing the type to or from food / tool moves the item to that file.
    - Catalog entries (`CatalogFormStore`, `CatalogEntryForm`): a `FormObjectInput` over the type's fields, with a link to the type; `CreateCatalogEntryDialog` starts from `typeDefault`.
    - **Delete** (`confirmDelete` → `DeletePreviewDialog`): the dialog first loads the dry run (`GET …/references`) and lists what will be cleared ("thomas race: set to dwarf", "village sublocations: removed") and what blocks the delete (code references; Delete is then disabled). After the delete the form shows the `cleared` notice (`components/clearedReferences.ts`).
- **Structure** (`pages/Structure/`, `#/structure`): the story's literals and types (`StructureList`: **Literals** (local ones with their file), **Story types**, **Engine types (extendable)**, **Engine types (read-only)**, each with "+ New"), and an editor (`StructureEditorStore`, one `DraftResource` per section).
    - `TypeEditor`: name and file, `StructureInput` with rename tracking, the catalog link ("2 races → open in Entities"), Save / Discard / Delete, notices. New local literals declared while editing are created in the type's file on Save, before `updateType`. After a save, "Updated 2 characters" (`touchedFiles`); a `422` from the instances offers **Reset incompatible values** (resends with `resetIncompatible`). Only story types can be deleted, and not while they are used. Engine types show their code read-only.
    - `LiteralEditor`: the values as chips (add, rename in place, move, remove), the scope (global or local to a file) and "Used by …". A rename is sent as `renames` and rewrites the stored values.
    - `CreateTypeDialog`: name, "has instances (catalog)" (on by default) and the catalog name (an English plural, editable; a catalog type starts with `name: string`). `CreateLiteralDialog`: name, values, global or local to a picked file.

## Files the Visualizer owns

Besides the `.ts` source it edits, the Visualizer owns these JSON files. They are validated whole-document replaces: an unknown field is a 400. A missing file reads as the default with `version: ''`, and a `PUT` with `version: ''` creates it.

- `data/locations/map.json`: tiles (one run-length-encoded string per row), palette, `tileText` keyed `"<row>,<col>"`, and location polygons keyed by location id in tile-renderer world coordinates. Format: [`Visualizer/README.md`](../Visualizer/README.md#mapjson). While it is missing, `GET` answers an empty map of the story's `mapSize` (`story.json`).
- `data/chapters/timeline.layout.json`: `{ chapters: { [id]: { y } }, triggers: { … } }`.
- `data/chapters/<ch>/<ch>.layout.json`: `{ passages: { [passageId]: { x, y } } }`.

## API

The source of truth is [`Visualizer/protocol/src/routes.ts`](../Visualizer/protocol/src/routes.ts): `STORY_ROUTES` and `GLOBAL_ROUTES` hold the paths and `TApiSpec` the body and response of each route. The server registers exactly these routes, and the client builds its URLs from them with `buildPath` (story routes) and `buildGlobalPath`.

- The server holds every story under `STORIES_ROOT` (`stories/<id>/`). A story route acts on one story and lives under `/api/stories/:storyId` (`storyApiPrefix`); the table below gives its path relative to that prefix. Each story has its own project, change feed and watcher, loaded on its first request and unloaded when idle (`server/src/stories/StoryContexts.ts`). An unknown story answers `404`.
- **Auth** (`server/src/auth/`, `server/src/stories/access.ts`): every story route needs a grant for its story in the `story_session` cookie (from `login`, 24 h, in memory), else `401`; SSE and image bytes included, and an `/events` stream is ended when its grant expires. `login` and `getStoryAccess` are global routes and need none; the images (`getImage`, `getImageFile`) of a `public` story need none either (`PUBLIC_STORY_READS`). Every mutation must send `content-type: application/json` (the import: `application/zip`), else `400`, and, if it has an `Origin`, one in `ALLOWED_ORIGINS` or matching its `Host` (CSRF). 10 wrong passwords per IP and story within 10 minutes answer `429`.
- **Stories** (`server/src/routes/stories.ts`, `storyInfo.ts`, `server/src/stories/`): anyone may list, create or import a story (plan D5). Create copies the template, writes `story.json` (scrypt hash), a `tsconfig.json` and an empty `map.json` of `mapSize`, and logs the creator in. The id is a slug of the name (`My Story` → `my-story`, then `my-story-2`, …), the folder name, and never changes. A new or imported story is built in a `.create-*` / `.import-*` temp folder of `STORIES_ROOT` and renamed into place, so it appears whole or not at all. `GET/PUT /info` and `/export` are story routes (a grant). The limits (name, password, map size) are `STORY_LIMITS` in `protocol/src/dto/story.ts`.
- **Zips** (`server/src/stories/zip.ts`): a story zip holds `story.json`, `tsconfig.json`, `data/`, `types/` at its root. Export skips `node_modules`, temp files and symlinks and gives every entry the same timestamp, so the same content always zips to the same bytes. Import takes the raw zip (`content-type: application/zip`, at most 50 MB) and refuses (`400`) an entry outside those names, with `..`, an absolute path or a backslash (zip-slip), a symlink, an encrypted or duplicate entry, a missing or invalid `story.json`, an unusable password hash, or more than 200 MB unpacked. It keeps the zip's `story.json` (password included) and writes a fresh `tsconfig.json`. A taken id is `409 exists` (plan D8); the importer is not logged in.
- Every route is under `/api` and speaks JSON, except `events` (SSE), `getImageFile` (the PNG bytes), `exportStory` (the zip) and the body of `importStory` (the zip).
- A `PUT` or `DELETE` body carries the `version` it was based on; a mismatch answers `409 stale` and writes nothing.
- `PUT` bodies are **partial** (`{ version, ...changedFields }`; an omitted field is left untouched). The map and the two layouts are the exception: their `PUT` replaces the whole document.
- `create*` routes, `importStory` and `addChapterCharacter` answer `201`; everything else answers `200`.
- `DELETE /entities/:kind/:id` and `DELETE /catalogs/:name/:id` answer `{ ok, cleared }` (see **Deleting a referenced instance**); their `GET …/references` answers `{ cleared, blocking }` and writes nothing.
- `:kind` is one of `characters | npcs | locations | items`. `:name` of a catalog is its export name (`races`), of a type or literal the type name (`TRace`, `TItemType`). `:mapId` is always `global`. For the images `:owner` is one of `passages | characters | npcs`, and its `:id` is a full passage id or an entity id; for the source it is `chapter | passage` (a chapter id or a full passage id).

| Name                                        | Method           | Path                                              |
| ------------------------------------------- | ---------------- | ------------------------------------------------- |
| `health`                                    | `GET`            | `/api/health`                                     |
| `listStories`                               | `GET`            | `/api/stories` (`TStoryListItemDto[]`)            |
| `createStory`                               | `POST`           | `/api/stories` (201 + cookie)                     |
| `importStory`                               | `POST`           | `/api/stories/import?id=<id>` (zip body, 201)     |
| `login`                                     | `POST`           | `/api/stories/:storyId/login` (204 + cookie)      |
| `logout`                                    | `POST`           | `/api/logout` (204, cookie cleared)               |
| `getSession`                                | `GET`            | `/api/session` (unlocked story ids)               |
| `getStoryAccess`                            | `GET`            | `/api/stories/:storyId/access` (`canEdit/Play`)   |
| `events`                                    | `GET`            | `/events` (SSE)                                   |
| `getProject`                                | `GET`            | `/project` (id/title lists of everything)         |
| `get/updateStoryInfo`                       | `GET/PUT`        | `/info` (`story.json` without the password)       |
| `exportStory`                               | `GET`            | `/export` (`<storyId>.zip`, an attachment)        |
| `createChapter`                             | `POST`           | `/chapters`                                       |
| `get/update/deleteChapter`                  | `GET/PUT/DELETE` | `/chapters/:chapterId`                            |
| `addChapterCharacter`                       | `POST`           | `/chapters/:chapterId/characters`                 |
| `removeChapterCharacter`                    | `DELETE`         | `/chapters/:chapterId/characters/:characterId`    |
| `listChapterPassages`                       | `GET`            | `/chapters/:chapterId/passages` (with edges)      |
| `createPassage`                             | `POST`           | `/chapters/:chapterId/passages`                   |
| `get/update/deletePassage`                  | `GET/PUT/DELETE` | `/passages/:passageId`                            |
| `createTrigger`                             | `POST`           | `/chapters/:chapterId/triggers`                   |
| `get/update/deleteTrigger`                  | `GET/PUT/DELETE` | `/triggers/:triggerId`                            |
| `listEntities` / `createEntity`             | `GET/POST`       | `/entities/:kind`                                 |
| `get/update/deleteEntity`                   | `GET/PUT/DELETE` | `/entities/:kind/:id`                             |
| `getEntityReferences`                       | `GET`            | `/entities/:kind/:id/references` (delete preview) |
| `listCatalogEntries` / `createCatalogEntry` | `GET/POST`       | `/catalogs/:name`                                 |
| `get/update/deleteCatalogEntry`             | `GET/PUT/DELETE` | `/catalogs/:name/:id` (`PUT`: the whole `values`) |
| `getCatalogEntryReferences`                 | `GET`            | `/catalogs/:name/:id/references`                  |
| `getStructure`                              | `GET`            | `/structure` (literals + types)                   |
| `createType`                                | `POST`           | `/structure/types`                                |
| `update/deleteType`                         | `PUT/DELETE`     | `/structure/types/:name`                          |
| `createLiteral`                             | `POST`           | `/structure/literals`                             |
| `update/deleteLiteral`                      | `PUT/DELETE`     | `/structure/literals/:name`                       |
| `addLiteralValue`                           | `POST`           | `/structure/literals/:name/values`                |
| `get/updateSource`                          | `GET/PUT`        | `/source/:owner/:id` (the whole file as text)     |
| `getImage` / `uploadImage`                  | `GET/PUT`        | `/images/:owner/:id` (`TImageDto`; PNG base64)    |
| `getImageFile`                              | `GET`            | `/images/:owner/:id/png` (bytes, `ETag`)          |
| `getMap` / `updateMap`                      | `GET/PUT`        | `/maps/:mapId`                                    |
| `get/updateTimelineLayout`                  | `GET/PUT`        | `/layout/timeline`                                |
| `get/updateChapterLayout`                   | `GET/PUT`        | `/layout/chapters/:chapterId`                     |

**Errors** (`dto/errors.ts`): every non-2xx answer is `{ error, message?, diagnostics?, references?, current? }`.

| Status | `error`             | Meaning                                                                            |
| ------ | ------------------- | ---------------------------------------------------------------------------------- |
| 400    | `bad_request`       | malformed JSON, missing or invalid fields, bad id                                  |
| 401    | `unauthorized`      | no grant for the story (log in), or a wrong password                               |
| 403    | `forbidden`         | a mutation from a foreign `Origin`; deleting an extendable or engine type          |
| 404    | `not_found`         | no such route or resource                                                          |
| 409    | `stale`             | `version` is not the one on disk; `current` is the fresh DTO (or `null`)           |
| 409    | `referenced`        | delete refused; `references` lists file, line and text of each reference           |
| 409    | `exists`            | create or import refused, the id is taken                                          |
| 422    | `invalid`           | the edit does not type-check (`diagnostics`, with a `field` path); nothing written |
| 429    | `too_many_requests` | too many wrong passwords                                                           |
| 500    | `internal`          | bug                                                                                |

**Events** (`dto/events.ts`): a story's `GET /api/stories/:storyId/events` sends `hello` on connect, then an `event: change` with `{ kind, id, version, op?, chapterId? }` for each change. `kind` is one of `chapter | passage | trigger | entity | map | layout | project | structure | catalog`, and `version` is `null` for a deletion. One server operation is one event, however many files it writes. Hand edits are batched over about 150 ms. An id ending in `*` is a wildcard: `trigger` `*` for a hand edit of `triggers.ts`, `entity` `items/*` for an items file, `catalog` `races/*` for a hand edit of a catalog file. `structure` (id `structure`) follows every change under `types/`, of a catalog file or of an items file; a catalog entry's id is `<catalog>/<id>`.

## Adding or changing a feature

1. **New or changed route**: edit `protocol/src/routes.ts` (`STORY_ROUTES` or `GLOBAL_ROUTES`, + `TApiSpec`) and the DTOs in `protocol/src/dto/`. Then:
    - add the handler in `server/src/routes/<resource>.ts` (with the reader or writer in `project/`)
    - add the method to `client/src/api/types.ts`, `httpApi.ts` and `mockApi.ts`
    - update the API table above
2. **New editable field**: extend the reader (source → DTO) and the writer's field list. Anything that is not a plain literal must stay `{code}`.
3. **New page**: add a route in `shell/router.ts`, a case in `shell/Shell.tsx`, a tab in `shell/TopBar.tsx`, and a `pages/<Name>/` folder with a MobX store that loads through `api`, subscribes to `apiEvents` and keeps view state in `ui-state`.
4. **Verify**: `yarn typecheck && yarn lint && yarn test`. The test projects are `visualizer-server` (node), `visualizer-client` (jsdom) and `visualizer-landing-page` (jsdom) in `vitest.workspace.ts`. To try writes against the real server, run it on a copy of `stories/`: `STORIES_ROOT=<copy> PORT=<port> yarn dev:visualizer-server`. When driving the Map page from headless Chrome, inject `* { transition: none !important }` first: a CSS transition over the map canvases (the location modal's Save button turning enabled) stalls the headless renderer.

## Open items

- `null` in a partial `PUT` removes an optional field (entity fields, a key of `userFields`, linear `nextPassageId`), and the Entities form sends it, but the protocol body types do not model `null` yet.
- `shell/router.ts` defines its own `ENTITY_KINDS`. Its order is the menu order, which differs from the protocol's.
- `client/index.html` links its favicon from `stories/example/data/assets`.
- Images are not resources of the event feed: an upload emits no event, and a `.png` added or changed by hand shows up the next time the form or panel is opened.
- Uploads are PNG only (the file picker offers `image/png`, the server checks the signature). There is no conversion, since the server has no image library, and no "remove image".
- Structure drafts are not kept across a page reload, and switching the selection drops an unsaved type or literal draft without asking.
- The mock API's versions are per object (the server's are file hashes), and the mock has no code references, so nothing blocks a delete there.
- Deleting a chapter's last trigger leaves an empty `triggers.ts`.
- There is no undo, multi-select, map resize or rename, or UI for sub-map links (`maps[]`).
