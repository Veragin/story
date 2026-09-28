# Story template

This project is software for creating and managing a story. User can create a world (characters, map, objects etc.) and describe a nonlinear story. While playing player can make story changing decisions. There should be possibility to play it as a multiplayer.
Will be used for writing a book, gamebooks or online single or multiplayer text games.

## Stories

**One installation holds many stories.** Each story is a folder under `stories/`, and the engine (everything else in the repository) is shared by all of them:

```
stories/
  example/          the reference story, committed; the engine's tests play it
    story.json      name, author, password hash, map size, description, public
    tsconfig.json   binds @story/types / @story/data to this story's own folders
    types/          the shape of the world (what a character _is_, what a location _has_)
    data/           the story itself (chapters, passages, characters, locations, items, art)
  <id>/             same shape; created, imported or exported from the landing page
```

That makes exactly two folders the author's working surface: **`stories/<id>/types/`** and **`stories/<id>/data/`**. Paths below like `data/chapters/…` are relative to the story's folder. `types/` is per story, not shared: its id types (`TCharacterId`, `TChapterId`, …) are derived from the story's own `data/TWorldState.ts`, so every story is type-checked on its own (`yarn typecheck` runs `scripts/typecheck-stories.mjs`). `story.json` belongs to the server: the landing page edits it, and it is never sent to a browser as-is nor opened in the source editor.

Only `stories/example/` is committed; every other folder under `stories/` is git-ignored and, on a server, lives on a volume (the server's `STORIES_ROOT`). A new story is made from the landing page (http://localhost:8103): it copies `Visualizer/server/template/`, the smallest story that type-checks. A story moves between installations as a zip (**Export** / **Import**). The example's two folders are also the `@story/data` / `@story/types` workspaces, so `core`'s tests and MultiEngine build against it; stories created at runtime are not workspaces.

Every story is behind its password: the Visualizer asks for it, and so does SingleEngine unless the story is `public`. A login lasts 24 h per story (see [`Visualizer/README.md`](../Visualizer/README.md)).

Everything outside `stories/` — `shared/`, `ui/`, `core/`, `SingleEngine/`, `Visualizer/`, `MultiEngine/` — is engine plumbing that an author should never need to open. The two folders are kept deliberately plain for this reason: no `src/` subfolder, no build step, no `dist/`. A passage is `data/chapters/village/village.chapter.ts`, and saving it (by hand, in the Visualizer's forms or in its source editor) refreshes the running apps.

The split is also what keeps an engine upgrade safe for every story at once: author edits land in `types/`/`data/`, and engine changes land everywhere else. **Nothing in `types/` or `data/` may import from a service**; `yarn lint` enforces it for every story (`import/no-restricted-paths` in `eslint.config.js`).

## Getting started

```bash
yarn install       # Yarn 4 workspaces; no build step, packages are consumed as TS source
yarn dev           # all six services at once, output labelled per workspace
yarn test          # Vitest
```

Single service, either way: `yarn dev:engine` / `yarn dev:visualizer` / `yarn dev:visualizer-server` / `yarn dev:landing-page` / `yarn dev:multi-engine` / `yarn dev:multi-engine-server`, or `make up` followed by `make dev-engine` / `make dev-visualizer` / `make dev-visualizer-server` / `make dev-landing-page` / `make dev-multi-engine` / `make dev-multi-engine-server`. (`make start` already holds all six ports, and the dev servers use `strictPort`, so start the container with `make up` when you want just one.) The landing page, the Visualizer client and SingleEngine all need the Visualizer server (it holds the stories and the logins); see [`Visualizer/README.md`](../Visualizer/README.md).

Other root scripts: `yarn typecheck`, `yarn build`, `yarn lint`, `yarn pretty`.

### Ports

| Service                       | Port | Status                               |
| ----------------------------- | ---- | ------------------------------------ |
| SingleEngine (vite)           | 8100 | implemented; proxies `/api` to 8123  |
| Visualizer client (vite)      | 8101 | implemented; proxies `/api` to 8123  |
| MultiEngine client (vite)     | 8102 | scaffold                             |
| Landing page (vite)           | 8103 | implemented; proxies `/api` to 8123  |
| Visualizer server (node/tsx)  | 8123 | implemented                          |
| MultiEngine server (node/tsx) | 8124 | scaffold — every route answers `501` |

`docker-compose.yml` publishes all six. The Visualizer client and the landing page call the server same-origin through their Vite proxies (`/api` → `http://localhost:8123`, override with `VISUALIZER_SERVER`), so the browser only needs 8100, 8101 and 8103 (SingleEngine proxies `/api` the same way, for the access check and the login). The landing page (the story list: create, edit, open, play, export, import) is the place to start.

## Data structure

- passage
    - means one screen that is displayed to player
    - contains image, text and options for player to decide how to continue
    - the image is the `.png` next to the passage file, with the same basename (`annie.passages/palace.ts` → `annie.passages/palace.png`); the passage's `image` field is only a text description of it. Characters and npcs get a portrait the same way (`data/characters/thomas.png`, `data/npcs/Franta.png`)
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
            image: 'Thomas, a young hunter, on a misty forest path.', // a description; the art is forest.png
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

Each folder is its own workspace (Yarn 4; of the stories, only the example's `data` and `types` are). Dependencies only ever point downwards in this list: `shared` imports nothing, the services may import any package, and no service may import another service. `eslint.config.js` encodes the whole thing.

### Author-edited (per story, under `stories/<id>/`)

- types
    - defines the structure of the data
    - edited by the author (directly, or through the Visualizer's "structure" tab)
    - only what the author edits: engine types that happen to be global (geometry, the passage-id format) live in `shared` instead

- data
    - folder where the story files are located
    - next to it: `story.json` (the story's info and password hash, owned by the server) and `tsconfig.json`
    - edited by the author (directly, or through the Visualizer's other tabs)
    - also holds the story's art: each image is the `.png` next to the `.ts` file of the passage, character or npc it belongs to (`data/assets/story.png` is only the apps' favicon)

### Engine packages

- shared
    - shared code between services
    - time
    - the global engine types no author ever edits: `TPoint`/`TSize`/`TVec`, and the `<chapter>-<character>-<passage>` id format (`TPassageId`, `TPassageIdFor`)
    - the bottom of the stack: depends on nothing

- ui
    - the React pieces the front-ends need: theme, layout primitives, toasts, the global stylesheet, and `PasswordDialog` (the story password prompt of the landing page, the Visualizer and SingleEngine)
    - exists so SingleEngine, the Visualizer and MultiEngine look like one product instead of three, and so MUI is a detail of one package rather than a dependency of every app

- core
    - the headless story runtime: engine, story, processor, history, inventory, world state
    - no React, no rendering — it is the same runtime whether it runs in a browser tab (SingleEngine), in a simulation (Visualizer) or on a server (MultiEngine), which is exactly why it cannot be owned by any one of them

### Services

- SingleEngine
    - a service that can play the story for single player
    - only client implementation
    - fully implemented
    - plays the story named by `?story=<id>` (the landing page's **Play as single**; without it, it goes to the landing page, `VITE_LANDING_URL`, default this host on 8103). `src/main.tsx` asks the Visualizer server `GET /api/stories/<id>/access`, shows the password dialog for a private story it may not play yet, then imports the story's virtual module `virtual:story/<id>` (its `data/index.ts` plus the URL of every `.png`) and starts the engine on it
    - `vite/storiesPlugin.ts` (`story:stories`) serves the stories from `STORIES_ROOT` (the server's, default `stories/`): `@story/types` / `@story/data` imported from inside `stories/<id>/` mean that story's folders, and every request for a story file (or its virtual module) is checked against `GET /api/stories/<id>/access` with the browser's cookie (cached 30 s) and answered `403` unless the story may be played. So the Visualizer server has to run too
    - the stories are served by the Vite dev server (plan D7); a per-story production build is future work

- MultiEngine
    - a service that can play the story for multiple players
    - splits into `MultiEngine/client/` and `MultiEngine/server/`
    - server handles the world state and story progress
    - client handles ui and comunicate with server
    - not implemented yet — both halves are scaffolds; the server boots and answers `501` to everything

- Visualizer
    - a service for creating and viewing the story and the world
    - used by the author of the game
    - splits into `Visualizer/client/` (React app), `Visualizer/server/` (node server that holds every story under `stories/`, guards each with its password, and reads and writes the `.ts` files in its `data/` and `types/`), `Visualizer/protocol/` (the typed API contract both import) and `Visualizer/landing-page/` (the story list: create, edit, open, play, export, import)
    - implemented: map, timeline, chapter view and entities pages; the structure tab is future work
    - see [`Visualizer/README.md`](../Visualizer/README.md) and [`docs/Visualizer.md`](Visualizer.md)

## MultiEngine

- every player picks his character
- they are going throuh passages - waiting for each other on time
- moving between passages costs some time, player has to wait till everyone played prevoius pasages
- server that handles world state
