The goal is to create a program that allows the creation of a playable gamebook. In the same world, within a similar timeframe, it should be possible to play as different characters and observe the chapters in the world from various perspectives. At the same time, the chapters in the world should be influenced by the decisions of individual characters. The program should support multiple people working on the same project.

## Basic Concepts

-   **world** is composed of a set of objects with properties.
-   **state of the world** refers to the values of the properties of the world's objects.
-   **chapter** is used to describe happenings in the world and consists of:
    -   a set of changes in the properties of the world's objects
    -   a set of pairs ("condition", chapter). The condition describes under what circumstances the next chapter should occur.
    -   a time interval that indicates within which time range the chapter can happen.
-   **passage** describes the state the player is currently in and also describes the options available to the player, allowing them to transition to a different passage. In the case of a playable gamebook, it refers to the code for rendering buttons to transition to another passage.
    -   each passage can be assigned an chapter it relates to.

## Visualizer

-   timeline,
    -   display chapters
    -   2 view: by location, by concrete character, by connections
    -   toggle display connections
    -   zoom
    -   display time triggers
    -   edit chapter?
        -   nodejs server + api
        -   browser (rights for all files vscode in browser) ???
        -   chapter time range (drag, move)
-   passage in chapter
    -   save position of passages to solo file
    -   display passage layout
    -   display chapter info
    -   time mode (can click throw passages) => display world state
-   display map with locations
    -   display characters position in time
-   api calls vscode server

MVP:

-   timeline: display chapter, toggle connections, zoom
    -   display timeline with labels
    -   everywhere mouse wheel can zoom (zoom levels: [den, 3 hodiny], [7 dní, den], [měsíc, 5dní], [rok, 2 měsíce])
    -   drag and drop timeline only
    -   display chapters
    -   toggle connections button, add spacesc to display arrows
    -   sort by connections
    -   double click open passage in chapter of the chapter
-   passage in chapter (bez time modu)
    -   same as in twine
-   display map location

## UX

-   Chapter Timeline

    -   button with modla window => add new chapter file in VS (API PUT `/chapter/<chapterId>`)
    -   single click select open info window
        -   open chapter file in VS (API POST `/chapter/<chapterId>/open`)
        -   open chapter file in VS (API DELETE `/chapter/<chapterId>`)
    -   holding ctrl will open chapter file instead
    -   by drag and drop edit start/end time (API POST `/chapter/<chapterId>/setTime`)
    -   double-click opens Chapter pasage view

-   Chapter pasage view
    -   button with modla window => add new passage file in VS (API PUT `/passage/<passageId>`)
    -   single click select open info window
        -   open passage file in VS (API POST `/passage/<passageId>/open`)
        -   open passage file in VS (API DELETE `/passage/<passageId>`)
    -   holding ctrl will open chapter file instead

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

# TODO

-   přejmenovat events na chapter
-   prejmenovat trigger na event
-   každý even má pole triggerů

-   místo na pasní poznámek
-   odebrat happenning
-   key chapter - dochází k rozhodujicímu splitu v příběhu
-   location list
