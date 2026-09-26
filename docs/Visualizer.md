# Visualizer

- this service is for creating the story data
- user interface to edit files in data and types folder

## Canvas library

- create library that will power this service
- you can reuse whats already implemented, but dont be afraid to rewrite it
- scene that holds canvas and all objects
- user can select object by clicking, move the selected object by dragging
- edit selected objects by addding more vertexes or dragging the vertexes, remove them by rightclick
- set color and border of object
- by double click call an action
- should be able to draw a line between two points

## Map tiles library

- implement https://github.com/Veragin/mapMaker
- user can fill tiles with color they want
- user can set description to a tile ... rendered on canvas

## UI

- top menu bar
    - tabs => user can switch between pages:
      map. timeline, entities, structure
    - on the right display control bar for the page

### Map

- consists of 2 layers Map tiles and Locations (Canvas library)
- Locations over the Map tiles
- in control bar:
    - mode switch
    - help button that opens modal
        - information how to move in the map page
        - zoom with scroll, move with WSAD, doubleclick to open
- autosave with debounce

- Modes:
    - view
        - block any edit
        - user is able to zoom and move via WSAD or arrows
        - double click on location will open location modal
        - no tooling row
    - Locations edit
        - allow edit locations (Canvas library editaion: select, drag, edit)
        - display tooling row
            - add new location
            - change location color (color picker)
            - open location modal (as well as doubleclick on location)
            - delete selected location
    - Map tiles
        - hide Locations layer
        - same funcionality as in mapMaker (drawing tiles)
        - display tooling row similar as is for mapMaker
        - allow to add description to map tile
        - save map tiles data to file in data/locations/map.json

- Location modal
    - open modal with location formular
    - display fileds:
        - id, readonly
        - name
        - description
        - local characters table
            - for each name and description
            - be able to add/remove characters

### Timeline

    - in control bar
        - add character selector (with option "All characters"), that will displays only chapters where is the selected character
        - button "Add" to create new chapter/time trigger, opens modal asks for chapter/trigger and chapterid/triggerId
        - display (toggle on/off) connections between the chapters (parent->childrens)
        - display (toggle) time triggers of the chapter (will show/hide time triggers)
    - at the bottom display timeline, with time ... already implemented, use as is
        - user can move the timeline by dragging
    - display chapters on timeline
        - already partialy implemented
        - box with name on it
        - dont lock y position of the chapter
        - chapter box has fixed height
        - user can select chepter by click
        - delete key opens delete confirmation of selected
        - user can by dragging move/x-resize the selected chapter
        - x position of start and end of the box is the start and end of the time period of the chapter
        - user can open chapter by double clicking
        - display chapter description on hover
    - display time triggers
        - select by click
        - move selected by drag
        - delete key opens delete confirmation of selected
        - by double click on open it in time trigger modal
        - display it as green dot above the timeline with name

- time trigger modal
    - edit time trigger name and description

#### chapter view

    - see twinery.org (similar implementation)
    - user can add/edit/delete passages in the chapter
    - display passages as boxes on canvas, move them by dragging
    - display arrows between connected passages
    - save position of passages to solo file (we have to save somewhere the position of the passage on the canvas)
    - user can edit chapter informations in modal form

### Entities

    - there is top horizontal menu listing
        - characters
        - locations
        - npc
        - items
        - other entites added by user
    - there is left vertical list - listing every created entity of the type
        - eg persons: tomas, annie
        - by clicking on item open form to set information about entity

### Structure

    - going to be implemented in the future, not now
    - there is left horizontal menu listing all types editable by user (structure)
    - eg. TCharacter

## Runtime (settled)

- **Node server** at `Visualizer/server/` (`@story/visualizer-server`) on **:8123**, run with `tsx watch`. It reads and writes the `.ts` files in `data/` and `types/` as source (ts-morph), plus the JSON files `data/locations/map.json` and `data/chapters/**/*.layout.json`. It never imports the story.
- The client (`Visualizer/client/`, Vite on **:8101**) calls it same-origin: Vite proxies `/api` to `http://localhost:8123` (`VISUALIZER_SERVER` overrides the target). With `VITE_VISUALIZER_API=mock` the client runs on an in-memory mock and needs no server.
- The contract is the workspace [`Visualizer/protocol`](../Visualizer/protocol/src/) (`@story/visualizer-protocol`): route constants in [`routes.ts`](../Visualizer/protocol/src/routes.ts) and every request/response type in [`dto/`](../Visualizer/protocol/src/dto/). Client and server both import it, so they cannot drift apart.
- Live refresh: file changes (the server's own writes and hand edits) arrive over `GET /api/events` and update the data on screen without reloading the page.
- Electron or a VS Code extension could wrap this later; neither is planned.

How to run it, how the source writer works and the known limitations: [`Visualizer/README.md`](../Visualizer/README.md).

## API (settled)

The source of truth is [`Visualizer/protocol/src/routes.ts`](../Visualizer/protocol/src/routes.ts) (`ROUTES` for the paths, `TApiSpec` for the body and response of each route). This section follows it.

- Every route is under `/api`. Bodies and responses are JSON.
- Every resource DTO carries `version` (a hash of the files behind it). Every `PUT` and `DELETE` body carries the `version` it was based on; a mismatch answers `409 stale` and writes nothing.
- `PUT` bodies are **partial** (`{ version, ...changedFields }`, omitted = untouched), except the map and the two layouts, which replace the whole document. `version: ''` on a map/layout `PUT` creates the missing file.
- Fields that can hold an expression are `TCode = { code: string }` (source text, written back verbatim) or a literal.
- Answers are `200`, and `201` for the `create*` routes and `addChapterCharacter`.

| Name                     | Method   | Path                                               | Body                          | Response              |
| ------------------------ | -------- | -------------------------------------------------- | ----------------------------- | --------------------- |
| `health`                 | `GET`    | `/api/health`                                      | —                             | `THealthDto`          |
| `events`                 | `GET`    | `/api/events`                                      | —                             | SSE stream            |
| `getProject`             | `GET`    | `/api/project`                                     | —                             | `TProjectDto`         |
| `createChapter`          | `POST`   | `/api/chapters`                                    | `TCreateChapterBody`          | `TChapterDto`         |
| `getChapter`             | `GET`    | `/api/chapters/:chapterId`                         | —                             | `TChapterDto`         |
| `updateChapter`          | `PUT`    | `/api/chapters/:chapterId`                         | `TUpdateChapterBody`          | `TChapterDto`         |
| `deleteChapter`          | `DELETE` | `/api/chapters/:chapterId`                         | `TDeleteChapterBody`          | `TOkDto`              |
| `openChapter`            | `POST`   | `/api/chapters/:chapterId/open`                    | —                             | `TOpenDto`            |
| `addChapterCharacter`    | `POST`   | `/api/chapters/:chapterId/characters`              | `TAddChapterCharacterBody`    | `TChapterDto`         |
| `removeChapterCharacter` | `DELETE` | `/api/chapters/:chapterId/characters/:characterId` | `TRemoveChapterCharacterBody` | `TChapterDto`         |
| `listChapterPassages`    | `GET`    | `/api/chapters/:chapterId/passages`                | —                             | `TChapterPassagesDto` |
| `createPassage`          | `POST`   | `/api/chapters/:chapterId/passages`                | `TCreatePassageBody`          | `TPassageDto`         |
| `getPassage`             | `GET`    | `/api/passages/:passageId`                         | —                             | `TPassageDto`         |
| `updatePassage`          | `PUT`    | `/api/passages/:passageId`                         | `TUpdatePassageBody`          | `TPassageDto`         |
| `deletePassage`          | `DELETE` | `/api/passages/:passageId`                         | `TDeletePassageBody`          | `TOkDto`              |
| `openPassage`            | `POST`   | `/api/passages/:passageId/open`                    | —                             | `TOpenDto`            |
| `createTrigger`          | `POST`   | `/api/chapters/:chapterId/triggers`                | `TCreateTriggerBody`          | `TTriggerDto`         |
| `getTrigger`             | `GET`    | `/api/triggers/:triggerId`                         | —                             | `TTriggerDto`         |
| `updateTrigger`          | `PUT`    | `/api/triggers/:triggerId`                         | `TUpdateTriggerBody`          | `TTriggerDto`         |
| `deleteTrigger`          | `DELETE` | `/api/triggers/:triggerId`                         | `TDeleteTriggerBody`          | `TOkDto`              |
| `listEntities`           | `GET`    | `/api/entities/:kind`                              | —                             | `TEntityListDto`      |
| `createEntity`           | `POST`   | `/api/entities/:kind`                              | `TCreateEntityBody`           | `TEntityDto`          |
| `getEntity`              | `GET`    | `/api/entities/:kind/:id`                          | —                             | `TEntityDto`          |
| `updateEntity`           | `PUT`    | `/api/entities/:kind/:id`                          | `TUpdateEntityBody`           | `TEntityDto`          |
| `deleteEntity`           | `DELETE` | `/api/entities/:kind/:id`                          | `TDeleteEntityBody`           | `TOkDto`              |
| `getMap`                 | `GET`    | `/api/maps/:mapId`                                 | —                             | `TMapDto`             |
| `updateMap`              | `PUT`    | `/api/maps/:mapId`                                 | `TUpdateMapBody`              | `TMapDto`             |
| `getTimelineLayout`      | `GET`    | `/api/layout/timeline`                             | —                             | `TTimelineLayoutDto`  |
| `updateTimelineLayout`   | `PUT`    | `/api/layout/timeline`                             | `TUpdateTimelineLayoutBody`   | `TTimelineLayoutDto`  |
| `getChapterLayout`       | `GET`    | `/api/layout/chapters/:chapterId`                  | —                             | `TChapterLayoutDto`   |
| `updateChapterLayout`    | `PUT`    | `/api/layout/chapters/:chapterId`                  | `TUpdateChapterLayoutBody`    | `TChapterLayoutDto`   |

- `:kind` is `characters | npcs | locations | items`. `:mapId` is `global` (the only map, `data/locations/map.json`).
- Create bodies:
    - `TCreateChapterBody`: `{ chapterId, title, description?, location, timeRange: { start, end } }`
    - `TCreatePassageBody`: `{ characterId, localId, type: 'screen' | 'linear' | 'transition', title? }`
    - `TCreateTriggerBody`: `{ triggerId, name, description?, time }`
    - `TAddChapterCharacterBody`: `{ characterId, startPassageLocalId? }` (default `intro`)
    - `TCreateEntityBody`: `{ id, ...editable fields }`, plus `type` for items
- Every `DELETE` body (and `removeChapterCharacter`'s) is `{ version }`.
- Ids (chapter, character, npc, location, item, trigger, passage local id) match `/^[a-z][A-Za-z0-9_]*$/`. Ids are read-only (no rename).

**Errors** (`dto/errors.ts`): every non-2xx answer is `{ error, message?, diagnostics?, references?, current? }`.

| Status | `error`           | Meaning                                                                  |
| ------ | ----------------- | ------------------------------------------------------------------------ |
| 400    | `bad_request`     | malformed JSON, missing or invalid fields                                |
| 404    | `not_found`       | no such route or resource                                                |
| 409    | `stale`           | `version` is not the one on disk; `current` is the fresh DTO (or `null`) |
| 409    | `referenced`      | delete refused, other files still point here (`references`)              |
| 409    | `exists`          | create refused, the id is taken                                          |
| 422    | `invalid`         | the edit does not type-check (`diagnostics`); nothing was written        |
| 501    | `not_implemented` | reserved; every route is implemented                                     |
| 500    | `internal`        | bug                                                                      |

**Events** (`dto/events.ts`): `GET /api/events` is a Server-Sent Events stream. It sends `hello` once on connect, then an `event: change` with `{ kind, id, version, op?, chapterId? }` per change. `kind` is `chapter | passage | trigger | entity | map | layout | project`. One server operation (even a multi-file write) is one event; hand edits are batched over about 150 ms. An id ending in `*` is a wildcard (`trigger` `*` for a hand edit of `triggers.ts`, `entity` `items/*` for an items file).
