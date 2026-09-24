# Story template

This project is software for creating and managing a story. User can create a world (characters, map, objects etc.) and describe a nonlinear story. While playing player can make story changing decisions. There should be possibility to play it as a multiplayer.
Will be used for writing a book, gamebooks or online single or multiplayer text games.

## One project per story

**The whole project is duplicated per story.** A story is not data loaded into a shared installation — it is a fork of this repository, and the story lives inside it.

That makes exactly two folders the author's working surface:

- **`types/`** — the shape of the world (what a character _is_, what a location _has_)
- **`data/`** — the story itself (chapters, passages, characters, locations, items, art)

Everything else — `shared/`, `ui/`, `core/`, `SingleEngine/`, `Visualizer/`, `MultiEngine/` — is engine plumbing that an author should never need to open. The two folders are kept deliberately plain for this reason: no `src/` subfolder, no build step, no `dist/`. A passage is `data/chapters/village/village.chapter.ts` and saving it hot-reloads the running app.

The split is also what keeps the fork maintainable. Pulling a newer engine into an existing story is a merge, and it only stays clean while author edits land in `types/`/`data/` and engine changes land everywhere else. **Nothing in `types/` or `data/` may import from a service**; `yarn lint` enforces it (`import/no-restricted-paths` in `eslint.config.js`).

## Getting started

```bash
yarn install       # Yarn 4 workspaces; no build step, packages are consumed as TS source
yarn dev           # all four services at once, output labelled per workspace
yarn test          # Vitest
```

Or in docker, which is the supported path:

```bash
make start         # builds the container and brings up every service
make logs          # follow them
make stop
```

Single service, either way: `yarn dev:engine` / `yarn dev:visualizer` / `yarn dev:visualizer-server` / `yarn dev:multi-engine`, or `make up` followed by `make dev-engine` / `make dev-visualizer` / `make dev-visualizer-server` / `make dev-multi-engine`. (`make start` already holds every port, and the dev servers use `strictPort`, so start the container with `make up` when you want just one.)

The Visualizer needs **two** of those: the client and its server. See the note under Ports.

Other root scripts: `yarn typecheck`, `yarn build`, `yarn lint`, `yarn pretty`.

### Ports

| Service                       | Port | Status                               |
| ----------------------------- | ---- | ------------------------------------ |
| SingleEngine (vite)           | 8100 | implemented                          |
| Visualizer client (vite)      | 8101 | implemented                          |
| MultiEngine client (vite)     | 8102 | scaffold                             |
| Visualizer server (node/swc)  | 8123 | implemented                          |
| MultiEngine server (node/tsx) | 8124 | scaffold — every route answers `501` |

`docker-compose.yml` publishes all five.

The Visualizer client proxies `/api` to the Visualizer server, so running the client alone
leaves every read and write failing. `yarn dev` (or `make start`) brings both up; to run them
individually it is `yarn dev:visualizer` **and** `yarn dev:visualizer-server`.

The Visualizer server runs its TypeScript from source like the MultiEngine one, but under
`@swc-node/register` rather than `tsx`: it is a NestJS app, Nest resolves constructor
dependencies through the `design:paramtypes` metadata, and esbuild — which is what `tsx` is —
documents that emit as unsupported because it never builds a type table. swc emits it.

## Data structure

- passage
    - means one screen that is displayed to player
    - contains image, text and options for player to decide how to continue
    - passage is written as a file with given structure (see `data/chapters/village/village.chapter.ts`)
    - filename is in format `<chapter>.<passage>.ts`
    - **a passage file exports a function, not an object**: it receives `(s, e)` — the world state and the engine — and returns the passage:

        ```ts
        export const forestPassage = (
            s: TWorldState,
            e: Engine
        ): TPassage<'village', 'thomas', TVillageThomasPassageId> => ({
            chapterId: 'village',
            characterId: 'thomas',
            id: 'forest',
            type: 'screen',
            title: 'Forest',
            image: 'hunter',
            body: [
                {
                    condition: true,
                    text: 'text',
                    links: [
                        {
                            text: 'Lets hunt',
                            passageId: 'village-thomas-intro',
                            cost: DeltaTime.fromMin(s.time.s < 10 ? 1 : 2),
                        },
                    ],
                },
            ],
        });
        ```

        Both arguments are optional to declare — most passages need neither and take none. The rule is that a passage reads live state **through its arguments only**: it must never import the running app or a world-state singleton. A passage that reaches for the app ties the story to one service, so it could not be replayed by the Visualizer, simulated by the MultiEngine server, or tested. `s` is the world state; `e` is the engine, for the few passages that need to ask it something rather than just read state.

- chapter
    - story is splitted into the chapters
    - chapter consists of set of passages
    - chapter has one starting passage
    - chapter can have multiple end passages (every end pasage points to another chapter)
    - we can display a tree of from passage can user get where
    - each chapter can have time triggers
    - each chapter has defined time period
    - an optional `layout` records where each passage sits in the Visualizer's chapter view,
      keyed by the `<chapter>-<character>-<passage>` id. It lives in the chapter file rather
      than a sidecar, so the positions are versioned with the story they belong to. A key that
      names a passage no longer present is ignored and pruned on the next save

- character
    - is a playable person in the world
    - there can be multiple of them, played as multiplayer or singleplayer (user choose and others are played by engine)

- sidecharacter
    - is non-playable but important person

- location
    - locations are describing the map of the world
    - each person has to be on some location
    - location knows its position by points of polygon mash shape — the optional `shape` field
      (`data/locations/village.location.ts`):

        ```ts
        shape: {
            mapId: 'global',
            points: [
                { x: 380, y: 420 },
                { x: 760, y: 380 },
                { x: 880, y: 620 },
            ],
            color: '#2e9e5b',
            z: 1,
        },
        ```

        Coordinates are world units on the named map. The ring is **implicitly closed** (a
        triangle is three points, never four) and wound clockwise; the Visualizer normalises
        both on every write, so the same shape always produces the same diff however it was
        drawn. A location with no `shape` simply is not on a map — the field is optional and a
        story with no map at all stays valid.

- map
    - the surface locations are drawn on: `data/maps/<mapId>.map.ts`, registered in
      `data/register.ts` under `maps`, which is what `TMapId` is `keyof`
    - a map owns its own furniture — `size`, an optional `background` bitmap, `notes` (free text
      placed in world space, for naming a river) and `strokes` (freehand brush lines) — plus
      optional nested `maps`, for pinning a town plan onto the world map
    - it does **not** list the locations drawn on it: each location carries its own polygon, so
      adding one is an edit to the file the author already has open rather than to two files
    - `strokes[].points` is a flat `[x, y, …]` array: roughly half the characters of the
      equivalent `{x, y}[]`, and the format the canvas draws natively. Coordinates are rounded
      to integers and the stroke is simplified before it is ever written, and the Visualizer
      server refuses an oversized `strokes` payload rather than committing a file no one can
      merge

- time triggers
    - an event triggered by time => something has happened

- items
    - item in the world to unify it

- world state
    - keeps the world informations during the play

## Folder structure

Each folder is its own workspace (Yarn 4). Dependencies only ever point downwards in this list: `shared` imports nothing, the services may import any package, and no service may import another service. `eslint.config.js` encodes the whole thing.

### Author-edited

- types
    - defines the structure of the data
    - edited by the author (directly, or through the Visualizer's "structure" tab)
    - only what the author edits: engine types that happen to be global (geometry, the passage-id format) live in `shared` instead

- data
    - folder where the story files are located
    - edited by the author (directly, or through the Visualizer's other tabs)
    - also holds the story's art, in `data/assets/`

### Engine packages

- shared
    - shared code between services
    - time
    - the global engine types no author ever edits: `TPoint`/`TSize`/`TVec`/`TPolygon`/`TBBox`/`TColor`, and the `<chapter>-<character>-<passage>` id format (`TPassageId`, `TPassageIdFor`)
    - the bottom of the stack: depends on nothing

- canvas
    - the one canvas library every Visualizer view is built on: a Konva-backed scene, a
      world↔screen viewport, polygons and boxes and edges and brush strokes, the editing tools,
      undo/redo, and the graph layout algorithms
    - imports `@story/shared` and nothing else internal, on purpose: it is a rendering library
      that happens to live here, and it knows nothing about locations, passages or chapters
    - React is a peer dependency reachable only through `@story/canvas/react`, which is one
      component — the scene is imperative, and no canvas state ever goes through React

- ui
    - the React pieces both front-ends need: theme, layout primitives, toasts, the global stylesheet
    - exists so SingleEngine, the Visualizer and MultiEngine look like one product instead of three, and so MUI is a detail of one package rather than a dependency of every app

- core
    - the headless story runtime: engine, story, processor, history, inventory, world state
    - no React, no rendering — it is the same runtime whether it runs in a browser tab (SingleEngine), in a simulation (Visualizer) or on a server (MultiEngine), which is exactly why it cannot be owned by any one of them

### Services

- SingleEngine
    - a service that can play the story for single player
    - only client implementation
    - fully implemented

- MultiEngine
    - a service that can play the story for multiple players
    - splits into `MultiEngine/client/` and `MultiEngine/server/`
    - server handles the world state and story progress
    - client handles ui and comunicate with server
    - not implemented yet — both halves are scaffolds; the server boots and answers `501` to everything

- Visualizer
    - a service for creating and viewing the story and the world
    - used by the author of the game
    - splits into `Visualizer/client/` (the tabs below) and `Visualizer/server/` (the file
      service that reads and writes `data/` and `types/`)
    - implemented

## Visualizer

- this service is for creating the story data
- user interface to edit data files

**It is a node server plus a browser client.** The other two options that were once on the table
— a VS Code extension and an Electron app — are closed. `Visualizer/server/` is a NestJS service
on :8123 that reads and writes the author's `.ts` files directly, and the client reaches it
through Vite's `/api` proxy.

Three things follow from that, and they shape everything below:

- **The server is a file service and a story index, not a story runtime.** It never constructs an
  `Engine`. Passages are functions of `(s, e)`, so listing what one links to by _running_ it would
  mean simulating the story in order to describe it; the passage graph is read statically instead,
  and anything that needs live state stays in the browser, where `@story/core` already runs.
- **Every write is a property-level edit.** The server locates a named property of a named export
  and replaces its initializer — it never re-prints a file, never reorders, and never drops a
  comment. Where it does not recognise the shape it refuses with a message rather than guessing:
  a passage is a _function_, so `PUT /api/passage/…` on an existing passage answers `422` and
  tells you to open the file.
- **Concurrent edits are detected, not lost.** Every read returns a content hash; a write sends it
  back in `If-Match` and a mismatch is a `409`. `POST …/open` exists to send you to your editor,
  so hand edits are a designed-for workflow rather than an edge case.

All the canvas views — map, timeline, chapter graph — are built on one shared library,
`@story/canvas`.

### UI

- tabs: timeline, map, entities, structure, plus the chapter, location and time-trigger views
  the other tabs open

- map
    - display locations on canvas
    - zoom on scroll
    - use WSAD or arrows to move in the map
    - user can draw there with brush tool
        - can select color
        - change brush size
        - by holding mouse it draws
    - user can add notes eg. draw a river and put name on it
    - add/edit/remove new location as polygon mash
    - user can open location by double click in location view
    - user can select location by click
    - user can change location color
    - user can move selected location by dragging

    A drawn polygon belongs to no location until you say which — the canvas library has no idea
    what a location is, by design — so the side panel asks. Saving writes each changed location's
    own file and the map's `notes`/`strokes` into `data/maps/`. Brush strokes are rounded to
    integers and simplified on mouse-up before they are ever sent, because they end up as
    TypeScript that a person has to merge.

- location view
    - location form allows to set informations about location

- timeline
    - display chapters on timeline per character, character selector
    - user can move the timeline by dragging
    - user can add/delete new chapter
    - user can select chapter or time trigger by click
    - user can move selected chapter by dragging
    - user can open chapter by double clicking
    - display (toggle on/off) connections between the chapters (end passages are pointing to some)
    - display chapter description on hover
    - display (toggle) time triggers of the chapter
    - by double click on time trigegr open it in time trigger view

- chapter view
    - see twinery.org (similar implementation)
    - user can add/edit/delete passages in the chapter
    - display passages as boxes on canvas, move them by dragging
    - display arrows between connected passages
    - save position of passages to solo file (we have to save somewhere the position of the passage on the canvas)
    - user can edit chapter informations in modal form

    Positions go into the chapter's own file, under `layout` — not a sidecar and not
    `localStorage`, so they are versioned with the story. The arrows come from reading the
    passage sources: a link that appears as a literal anywhere in a passage is drawn, including
    in branches the player may never reach. That over-reports rather than under-reports, which is
    the right way round for a map of the story.

- time trigger view
    - form to set up time trigegr

    Read-only, and deliberately: a trigger is an entry in a chapter's inline `triggers` array and
    its condition and effect are functions, which the writer refuses to rewrite. The view tells
    you which chapter it belongs to and when it fires, and opens the file at the right line.

- entities
    - display menu with all etities where user can select entity
    - for selected entity display list of items, eg.:
        - characters
        - locations
        - items
        - other entites added by user
    - each can be opened and edited

- structure
    - user can define entites (eg add new entity race), add/edit/delete
    - user can edit entites (eg. person can have race, or add new field to locations)
    - its is editing @types folder

    Only type aliases declared as a plain object type are editable; everything else — the derived
    id unions, mapped and conditional types — is listed read-only **with the reason**. A new field
    added here shows up in the entities tab immediately, because that tab reads the type rather
    than a hard-coded list. Every change is written, typechecked with the repo's own `tsc`, and
    rolled back if it fails, so an experiment here cannot leave the story unable to build.

## MultiEngine

- every player picks his character
- they are going throuh passages - waiting for each other on time
- moving between passages costs some time, player has to wait till everyone played prevoius pasages
- server that handles world state

## Not implemented/decied yet

- MultiEngine — both halves are still scaffolds

**Settled:** how the Visualizer works, and how it talks to its server. It is a node server at
`Visualizer/server/` on :8123, the client proxies `/api` to it, and the API is the one documented
below. The VS Code extension and Electron options are closed.

The hard part named here — reading and writing the `.ts` files in `data/` and `types/` while
preserving hand-written passage logic — is solved by refusing to rewrite anything whose shape is
not understood, and by typechecking structural edits before keeping them. See the Visualizer
section above.

## API

Served by `Visualizer/server/` on :8123, all under an `/api` prefix, all JSON. The client reaches
it same-origin through Vite's proxy, so `Visualizer/client/src/stores/Agent.ts` uses paths, not a
host.

Every failure answers `{ success: false, error }`. The status codes carry meaning:

| Status | Means                                                                                       |
| ------ | ------------------------------------------------------------------------------------------- |
| `400`  | The request is malformed — an unknown property, a coordinate that is `NaN`                  |
| `404`  | No such chapter / passage / location / map                                                  |
| `409`  | The file changed on disk since you read it. The body carries both hashes; refetch and retry |
| `413`  | A map's brush strokes are over the size budget (2 MB by default)                            |
| `422`  | The request was fine but the **source file** is not a shape the writer will edit. See below |

`422` is the interesting one. It is what you get for asking the server to rewrite a passage (a
function), to edit a type alias it does not fully understand, or to make a structural change that
does not compile — in which case the body carries `tsc`'s own output and nothing was written.

### Optimistic concurrency

Every read returns a `hash` of the file it came from. Send it back as `If-Match` on the write; a
mismatch is a `409`. Omitting it is allowed and means "I am not participating", which is right for
a first write and wrong for anything you rendered a form from.

### Routes

```
GET    /api/health                       status + the repo root it resolved
GET    /api/story                        ids and titles of everything, one round trip at boot
GET    /api/events                       SSE: {type:'changed', path} when data/ or types/ change

GET    /api/chapter                      list
GET    /api/chapter/:chapterId
GET    /api/chapter/:chapterId/passages  one chapter's passages, with the static link graph
PUT    /api/chapter/:chapterId           title, description, location
POST   /api/chapter/:chapterId/setTime   { start, end } in seconds
PUT    /api/chapter/:chapterId/layout    { [passageId]: {x, y} } — the chapter view's positions
POST   /api/chapter/:chapterId/open
DELETE /api/chapter/:chapterId           refuses while another chapter names it as a child

GET    /api/passage/:type/:passageId     type ∈ screen | linear | transition
PUT    /api/passage/:type/:passageId     creates one; 422 on an existing passage (it is a function)
POST   /api/passage/:type/:passageId/setTime   always 422 — a cost lives inside a link
POST   /api/passage/:type/:passageId/open
DELETE /api/passage/:type/:passageId     reports which passages still link to it

GET    /api/location                     list
GET    /api/location/:locationId
PUT    /api/location/:locationId         name, description, and `shape` (the polygon)
POST   /api/location/:locationId/open
DELETE /api/location/:locationId

GET    /api/map                          list
GET    /api/map/:mapId                   includes `locationIds` — the locations drawn on it
PUT    /api/map/:mapId                   title, size, background, notes, strokes
POST   /api/map/:mapId/open
DELETE /api/map/:mapId                   refuses while a location is drawn on it

GET    /api/entity                       the entity kinds and their members
GET    /api/entity/:kind/:id             editable fields, plus the read-only ones and why
PUT    /api/entity/:kind/:id             { fields: { … } }
POST   /api/entity/:kind/:id/open
DELETE /api/entity/:kind/:id

GET    /api/structure                    every type alias in types/, editable or not
GET    /api/structure/:typeName
PUT    /api/structure/:typeName          { edits: [{ action, name, type?, optional?, doc? }] }
POST   /api/structure/:typeName/open
```

`shape: null` on a location write removes it from the map; **omitting** `shape` leaves the polygon
alone. The two are different on the wire on purpose — a client saving only the name must not erase
the geometry by omission.

`PUT /api/structure/:typeName` writes the file, runs the repo's own `tsc --noEmit`, and restores
the previous bytes if it fails. A structural edit that does not compile is never kept.
