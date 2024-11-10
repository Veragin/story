The goal is to create a program that allows the creation of a playable gamebook. In the same world, within a similar timeframe, it should be possible to play as different characters and observe the events in the world from various perspectives. At the same time, the events in the world should be influenced by the decisions of individual characters. The program should support multiple people working on the same project.

## Basic Concepts

-   **world** is composed of a set of objects with properties.
-   **state of the world** refers to the values of the properties of the world's objects.
-   **event** is used to describe happenings in the world and consists of:
    -   a set of changes in the properties of the world's objects
    -   a set of pairs ("condition", event). The condition describes under what circumstances the next event should occur.
    -   a time interval that indicates within which time range the event can happen.
-   **linear event** is an event extended with a duration. It may contain sub-events that have a fixed time offset from the start of the event. It is used to describe a non-branching part of the story. It can display sub-events on a timeline.
-   **passage** describes the state the player is currently in and also describes the options available to the player, allowing them to transition to a different passage. In the case of a playable gamebook, it refers to the code for rendering buttons to transition to another passage.
    -   each passage can be assigned an event it relates to.

## Insights

### Objekty sveta

Samotne objekty sveta muzeme vyjadrit jako singletony.
Typy pro definovani spolecnych vlastnosti vice objektu pak mohou rozsirovat tyto objekty.

Staticka vlastnost singletonu lze vyuzit primym odkazem v nejake pasazi. Zaroven by takovy objekt vlastnil
svuj typ, coz by znamenalo, ze pri spatnem napsani vlastnosti by se kompilator mohl ozvat pri kontrole.

Hodilo by se, kdybychom mohli rikat z pohledu uzivatele, ve kterych udalostech je pro nas dana vlastnost, respektive mnozina vlastnosti
daneho objektu dulezita.

Realne, pri psani zmen vlastnosti v pasazi by naseptavac naseptaval vlastnosti podle udalosti, ktere se tyka.

### Typy pasazi

Uzivatel by mel mit moznost nadefinovat vlastni typ pasaze spolu s vlastnim frameworkem.

## Visualizer

-   timeline,
    -   display events
    -   2 view: by location, by concrete character, by connections
    -   toggle display connections
    -   zoom
    -   display time triggers
    -   edit event?
        -   nodejs server + api
        -   browser (rights for all files vscode in browser) ???
        -   event time range (drag, move)
-   passage in event
    -   save position of passages to solo file
    -   display passage layout
    -   display event info
    -   time mode (can click throw passages) => display world state
-   display map with locations
    -   display characters position in time
-   api calls vscode server

MVP:

-   timeline: display event, toggle connections, zoom
    -   display timeline with labels
    -   everywhere mouse wheel can zoom (zoom levels: [den, 3 hodiny], [7 dní, den], [měsíc, 5dní], [rok, 2 měsíce])
    -   drag and drop timeline only
    -   display events
    -   toggle connections button, add spacesc to display arrows
    -   sort by connections
    -   double click open passage in event of the event
-   passage in event (bez time modu)
    -   same as in twine
-   display map location

## UX

-   Event Timeline

    -   button with modla window => add new event file in VS (API PUT `/event/<eventId>`)
    -   single click select open info window
        -   open event file in VS (API POST `/event/<eventId>/open`)
        -   open event file in VS (API DELETE `/event/<eventId>`)
    -   holding ctrl will open event file instead
    -   by drag and drop edit start/end time (API POST `/event/<eventId>/setTime`)
    -   double-click opens Event pasage view

-   Event pasage view
    -   button with modla window => add new passage file in VS (API PUT `/passage/<passageId>`)
    -   single click select open info window
        -   open passage file in VS (API POST `/passage/<passageId>/open`)
        -   open passage file in VS (API DELETE `/passage/<passageId>`)
    -   holding ctrl will open event file instead

## API

-   data sent as JSON body

-   PUT `/event/<eventId>`
    -   title: String
    -   description: String
    -   location: String
    -   startTime: TimeString
    -   endTime: TimeString
-   POST `/event/<eventId>/open`
-   DELETE `/event/<eventId>`
-   POST `/event/<eventId>/setTime`

    -   startTime: TimeString
    -   endTime: TimeString

-   PUT `/passage/<passageId>`
    -   title: String
    -   type: 'screen' | 'linear' | 'transition'
-   POST `/passage/<passageId>/open`
-   DELETE `/passage/<passageId>`
