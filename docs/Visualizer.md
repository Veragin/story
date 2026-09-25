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

## Not implemented/decied yet

- how Visualizer will work, multiple options:
    - running nodejs server
    - vscode extension maybe
    - electron
- api communication

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
