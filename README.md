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

Single service, either way: `yarn dev:engine` / `yarn dev:visualizer` / `yarn dev:multi-engine`, or `make up` followed by `make dev-engine` / `make dev-visualizer` / `make dev-multi-engine`. (`make start` already holds all four ports, and the dev servers use `strictPort`, so start the container with `make up` when you want just one.)

Other root scripts: `yarn typecheck`, `yarn build`, `yarn lint`, `yarn pretty`.

### Ports

| Service                       | Port | Status                               |
| ----------------------------- | ---- | ------------------------------------ |
| SingleEngine (vite)           | 8100 | implemented                          |
| Visualizer client (vite)      | 8101 | partially implemented                |
| MultiEngine client (vite)     | 8102 | scaffold                             |
| Visualizer server             | 8123 | **not built yet**                    |
| MultiEngine server (node/tsx) | 8124 | scaffold — every route answers `501` |

`docker-compose.yml` publishes 8100, 8101, 8102 and 8124. 8123 is reserved, not published, because nothing listens on it yet.

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

- character
    - is a playable person in the world
    - there can be multiple of them, played as multiplayer or singleplayer (user choose and others are played by engine)

- sidecharacter
    - is non-playable but important person

- location
    - locations are describing the map of the world
    - each person has to be on some location
    - location knows its position by points of polygon mash shape

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
    - the global engine types no author ever edits: `TPoint`/`TSize`/`TVec`, and the `<chapter>-<character>-<passage>` id format (`TPassageId`, `TPassageIdFor`)
    - the bottom of the stack: depends on nothing

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
    - currently `Visualizer/client/` only; it will gain a `Visualizer/server/` the same way MultiEngine has one (see "Not implemented/decied yet" below)
    - partially implemented

## Visualizer

- this service is for creating the story data
- user interface to edit files in data and types folder

### Canvas library

- create library that will power this service
- you can reuse whats already implemented, but dont be afraid to rewrite it
- scene that holds canvas and all objects
- user can select object by clicking, move the selected object by dragging
- edit selected objects by addding more vertexes or dragging the vertexes, remove them by rightclick
- set color and border of object
- by double click call an action
- should be able to draw a line between two points

### Map tiles library

- implement https://github.com/Veragin/mapMaker
- user can fill tiles with color they want
- user can set description to a tile ... rendered on canvas

### UI

- top menu tabs => user can switch between pages:
  map. timeline, entities, structure

### Map UI

- consists of 2 layers Map tiles and Locations (Canvas library)
- Locations over the Map tiles
- in top bar is mode switch
- autosave with debounce

- Modes:
    - view
        - block any edit
        - user is able to zoom and move via WSAD or arrows
        - double click on location will open location form
        - no tooling row
    - Locations edit
        - allow edit locations (Canvas library editaion: select, drag, edit)
        - display tooling row
            - add new location
            - change location color (color picker)
            - open location form (as well as doubleclick on location)
            - delete selected location
    - Map tiles
        - hide Locations layer
        - same funcionality as in mapMaker (drawing tiles)
        - display tooling row similar as is for mapMaker
        - allow to add description to map tile
        - save map tiles data to file in data/locations/map.json

- location form
    - open modal with location form

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

- time trigger view
    - form to set up time trigegr

- entities
    - persons
    - items
    - other entites added by user

- structure
    - user can define entites (eg add new entity race)
    - user can edit entites (eg. person can have race, or add new field to locations)
    - he is editing @types folder

## MultiEngine

- every player picks his character
- they are going throuh passages - waiting for each other on time
- moving between passages costs some time, player has to wait till everyone played prevoius pasages
- server that handles world state

## Not implemented/decied yet

- how Visualizer will work, multiple options:
    - running nodejs server
    - vscode extension maybe
    - electron
- api communication
- MuiltiEngine

**Still open.** The client already speaks a protocol (see API below) and `Visualizer/client/src/stores/Store.ts` hardcodes `http://localhost:3123` for a server that does not exist. If the nodejs option wins, it lands at `Visualizer/server/` on :8123 and the client proxies `/api` to it; the hard part is that it has to read and write the `.ts` files in `data/` and `types/`, emitting valid TypeScript while preserving hand-written passage logic. That is why it is a separate piece of work and not just another service. The other two options (vscode extension, electron) are still on the table and would not need the port at all.

## API

- **not implemented, and the two descriptions of it disagree.** The routes below are as originally specified. `Visualizer/client/src/stores/Agent.ts` calls a different set:
    - everything is under an `/api` prefix — `/api/chapter/<chapterId>`, not `/chapter/<chapterId>`
    - the passage routes carry the passage type in the path — `/api/passage/screen/<passageId>`, not `/passage/<passageId>`
    - the client has an `/api/passage/screen/<passageId>/setTime` that is not documented here at all

    Neither description has been made authoritative, because nothing serves these routes yet. It gets settled when the Visualizer server is built.

- data sent as JSON body

- PUT `/chapter/<chapterId>`
    - title: String
    - description: String
    - location: String
    - startTime: TimeString
    - endTime: TimeString
- POST `/chapter/<chapterId>/open`
- DELETE `/chapter/<chapterId>`

- POST `/chapter/<chapterId>/setTime`
    - startTime: TimeString
    - endTime: TimeString

- PUT `/passage/<passageId>`
    - title: String
    - type: 'screen' | 'linear' | 'transition'
- POST `/passage/<passageId>/open`
- DELETE `/passage/<passageId>`

- PUT `/map/<mapId>`
    - title: String
    - width: Int
    - height: Int
    - data: { tile: String; title?: String }[][]
    - locations: { i: Int; j: Int; locationId: String }[]
    - maps: { i: Int; j: Int; mapId: String }[]
- GET `/map/<mapId>`
- GET `/map`
    - mapId: String
    - title: String
