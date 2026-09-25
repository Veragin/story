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
    - describes compact part of the story
    - characters can do decisions (change state of the world) that will influence which chapters will be played (active)
    - there can be multiple active chapters at the same moment (with multiple players playing)
    - each chapter consists of set of passages for a characters
    - per each present character
        - there is only one starting passage
        - can be multiple ending passages (called transitions) that reference the swicth of character between chapters
    - each chapter can have time triggers
    - each chapter has defined time period
    - each chapter has children (means all chapters to which the characters can move to)

- story
    - is splitted into the chapters
    - story is nonlinear described by chapters

- character
    - is a playable character in the world
    - there can be multiple of them, played as multiplayer or singleplayer
    - if single player and there is multiple characters => others are played by engine

- npc
    - is non-playable but important character

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

## MultiEngine

- every player picks his character
- they are going throuh passages - waiting for each other on time
- moving between passages costs some time, player has to wait till everyone played prevoius pasages
- server that handles world state
