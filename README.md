# Story template

This project is software for creating and managing a story. User can create a world (characters, map, objects etc.) and describe a nonlinear story. While playing player can make story changing decisions. There should be possibility to play it as a multiplayer.
Will be used for writing a book, gamebooks or online single or multiplayer text games.

## Data structure

-   passage

    -   means one screen that is displayed to player
    -   contains image, text and options for player to decide how to continue
    -   passage is written as a file with given structure (see src/data/chapters/village/village.chapter.ts)
    -   filename is in format `<chapter>.<passage>.ts`

-   chapter

    -   story is splitted into the chapters
    -   chapter consists of set of passages
    -   chapter has one starting passage
    -   chapter can have multiple end passages (every end pasage points to another chapter)
    -   we can display a tree of from passage can user get where
    -   each chapter can have time triggers
    -   each chapter has defined time period

-   character

    -   is a playable person in the world
    -   there can be multiple of them, played as multiplayer or singleplayer (user choose and others are played by engine)

-   sidecharacter

    -   is non-playable but important person

-   location

    -   locations are describing the map of the world
    -   each person has to be on some location
    -   location knows its position by points of polygon mash shape

-   time triggers

    -   an event triggered by time => something has happened

-   items

    -   item in the world to unify it

-   world state

    -   keeps the world informations during the play

## Folder structure

-   types

    -   defines the structure of the data

-   data

    -   folder where the story files are located

-   shared

    -   shared code between services
    -   time

-   SingleEngine

    -   a service that can play the story for single player
    -   only client implementation
    -   fully implemented

-   MultiEngine

    -   a service that can play the story for multiple players
    -   has server and client part
    -   server handles the world state and story progress
    -   client handles ui and comunicate with server
    -   not implemented yet

-   Visualizer

    -   a service for creating and viewing the story and the world
    -   used by the author of the game
    -   partially implemented

## Visualizer

-   this service is for creating the story data
-   user interface to edit data files

### UI

-   tabs: map. timeline, entities, structure

-   map

    -   display locations on canvas
    -   user can draw there with brush (change colors)
    -   user can add notes ed. draw a river and add name on it
    -   add/edit/remove new location as polygon mash
    -   user can open location in location view

-   location view

    -   manage location

-   timeline

    -   display chapters on timeline per character
    -   user can move the timeline by dragging
    -   user can add/delete new chapter
    -   user can move chapter by dragging (needs to hold ctrl)
    -   user can open chapter by clicking
    -   display (toggle on/off) connections between the chapters (end passages are pointing to some)
    -   display chapter description on hover
    -   partially implemented
    -   display (toggle) time triggers

-   chapter view

    -   user can manage passages in the chapter
    -   save position of passages to solo file (we have to save somewhere the position of the passage on the plate ... not important for the play)
    -   user can edit chapter informations

-   entities

    -   persons
    -   items
    -   other entites added by user

-   structure
    -   user can manage entites (eg add race)
    -   user can edit required types (eg. person can have race)

## MultiEngine

-   every player picks his character
-   they are going throuh passages - waiting for each other on time
-   moving between passages costs some time, player has to wait till everyone played prevoius pasages
-   server that handles world state

## Not implemented/decied yet

-   how Visualizer will work, multiple options:
    -   running nodejs server
    -   vscode extension maybe
    -   electron
-   api communication
-   MuiltiEngine

## API

-   data sent as JSON body

-   PUT `/chapter/<chapterId>`
    -   title: String
    -   description: String
    -   location: String
    -   startTime: TimeString
    -   endTime: TimeString
-   POST `/chapter/<chapterId>/open`
-   DELETE `/chapter/<chapterId>`

-   POST `/chapter/<chapterId>/setTime`

    -   startTime: TimeString
    -   endTime: TimeString

-   PUT `/passage/<passageId>`
    -   title: String
    -   type: 'screen' | 'linear' | 'transition'
-   POST `/passage/<passageId>/open`
-   DELETE `/passage/<passageId>`

-   PUT `/map/<mapId>`
    -   title: String
    -   width: Int
    -   height: Int
    -   data: { tile: String; title?: String }[][]
    -   locations: { i: Int; j: Int; locationId: String }[]
    -   maps: { i: Int; j: Int; mapId: String }[]
-   GET `/map/<mapId>`
-   GET `/map`
    -   mapId: String
    -   title: String
