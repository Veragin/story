# Story template

This project is software for creating and managing a story. User can create a world (characters, map, objects etc.) and describe a nonlinear story. While playing player can make story changing decisions. There should be possibility to play it as a multiplayer.
Will be used for writing a book, gamebooks or online single or multiplayer text games.

## Stories

**One installation holds many stories.** Each story is a folder under `stories/`, and the engine (everything else in the repository) is shared by all of them:

```
stories/
  example/          the reference story, committed; the engine's tests play it
    tsconfig.json   binds @story/types / @story/data to this story's own folders
    types/          the shape of the world (what a character _is_, what a location _has_)
    data/           the story itself (chapters, passages, characters, locations, items, art)
  <id>/             same shape; created, imported or exported from the landing page
```

That makes exactly two folders the author's working surface: **`stories/<id>/types/`** and **`stories/<id>/data/`**. Paths below like `data/chapters/…` are relative to the story's folder. `types/` is per story, not shared: its id types (`TCharacterId`, `TChapterId`, …) are derived from the story's own `data/TWorldState.ts`, so every story is type-checked on its own (`yarn typecheck` runs `scripts/typecheck-stories.mjs`). A story's metadata (name, author, password hash, map size, description, public) is not in its folder: it is a row in the server's MySQL database, edited from the landing page (the example's row is seeded from `server/seed/example.story.json`).

Only `stories/example/` is committed; every other folder under `stories/` is git-ignored and, on a server, lives on a volume (the server's `STORIES_ROOT`). A new story is made from the landing page (http://localhost:8103): it copies `server/template/`, the smallest story that type-checks. A story moves between installations as a zip (**Export** / **Import**). **Export for web** makes a zip that plays on any static web host, without this server: [`SinglePlayerStandalone.md`](SinglePlayerStandalone.md). The example's two folders are also the `@story/data` / `@story/types` workspaces, so `core`'s tests and MultiEngine build against it; stories created at runtime are not workspaces.

Every story is behind its password: the Visualizer asks for it, and so does SinglePlayer unless the story is `public`. A login lasts 24 h per story (see [`Server.md`](Server.md#auth)).

Everything outside `stories/` — `clients/` (the apps and the shared `clients/shared/{core,utils,ui,storyLoader}` packages), `protocol/`, `server/` — is engine plumbing that an author should never need to open. The two folders are kept deliberately plain for this reason: no `src/` subfolder, no build step, no `dist/`. A passage is `data/chapters/village/village.chapter.ts`, and saving it (by hand, in the Visualizer's forms or in its source editor) refreshes the running apps.

The split is also what keeps an engine upgrade safe for every story at once: author edits land in `types/`/`data/`, and engine changes land everywhere else. **Nothing in `types/` or `data/` may import from a service**; `yarn lint` enforces it for every story (`import/no-restricted-paths` in `eslint.config.js`).

## Repository layout

```
stories/        the stories (only example/ is committed); see above
clients/
  SinglePlayer/   @story/single-player            plays one story, Vite :8100
  Visualizer/     @story/visualizer-client        the author's editor, Vite :8101
  MultiEngine/    @story/multi-engine-client      scaffold, Vite :8102
  LandingPage/    @story/visualizer-landing-page  the story list, Vite :8103
  shared/         core/ (@story/core)  utils/ (@story/shared)  ui/ (@story/ui)
protocol/       @story/protocol   the wire contract: routes (with access levels), DTOs, errors
server/         @story/server     NestJS + MySQL on :8123, the only server; see Server.md
docker/         docker-compose.yml (dev, + mysql), docker-compose.prod.yml, Dockerfiles, Caddyfile, prod-entrypoint.sh, mysql/init/
docs/           this file, Server.md, Visualizer.md, SinglePlayerStandalone.md
scripts/        typecheck-stories.mjs
```

## Getting started

In docker (the usual way): `make start` builds the dev image, starts it with the `mysql` service (MySQL 8.4, databases `story` and `story_test`, reachable from the dev container as `mysql:3306`, not published) and runs `yarn dev` inside. `make logs` follows the output, `make bash` opens a shell, `make destroy` also deletes the database volume.

```bash
yarn install       # Yarn 4 workspaces; no build step, packages are consumed as TS source
yarn dev           # every service at once, output labelled per workspace
yarn test          # Vitest; the server suites need MySQL (database story_test)
```

Outside docker, run a MySQL 8 with the compose credentials (user `story`/`story`, databases `story` and `story_test`) and prefix the commands with `DB_HOST=127.0.0.1`.

- **Migrations** run on their own: the server applies pending ones on boot. By hand: `yarn workspace @story/server migration:show|run|revert`; new ones: [`Server.md`](Server.md#database-and-migrations).
- **Seeding**: on every start, the dev server runs `stories:import-files --seed stories/example`, which inserts the example's row from `server/seed/example.story.json` when it is missing (password `example`).

Single service, either way: `yarn dev:player` / `yarn dev:visualizer` / `yarn dev:server` / `yarn dev:landing-page` / `yarn dev:multi-engine`, or `make up` followed by `make dev-player` / `make dev-visualizer` / `make dev-server` / `make dev-landing-page` / `make dev-multi-engine`. (`make start` already holds all five ports, and the dev servers use `strictPort`, so start the container with `make up` when you want just one.) The landing page, the Visualizer client and SinglePlayer all need the server.

Other root scripts: `yarn typecheck`, `yarn build`, `yarn lint`, `yarn pretty`, `yarn pretty:check`.

### Ports

| Service                   | Port | Status                              |
| ------------------------- | ---- | ----------------------------------- |
| SinglePlayer (vite)       | 8100 | implemented; proxies `/api` to 8123 |
| Visualizer client (vite)  | 8101 | implemented; proxies `/api` to 8123 |
| MultiEngine client (vite) | 8102 | scaffold                            |
| Landing page (vite)       | 8103 | implemented; proxies `/api` to 8123 |
| Server (NestJS)           | 8123 | implemented; needs MySQL            |

`docker/docker-compose.yml` publishes all five. The apps call the server same-origin through their Vite proxies (`/api` → `http://localhost:8123`, override with `STORY_SERVER`), so the browser only needs 8100, 8101 and 8103. The landing page (the story list: create, edit, open, play, export, import) is the place to start.

### Production

`docker/docker-compose.prod.yml` runs everything behind one origin, with Caddy (`docker/Caddyfile`) in front, on ports 80 and 443:

| Path           | Served by                                                                                          |
| -------------- | -------------------------------------------------------------------------------------------------- |
| `/`            | the landing page, static build                                                                     |
| `/visualizer/` | the Visualizer client, static build (Vite `base` `/visualizer/`)                                   |
| `/play/`       | SinglePlayer, static build (Vite `base` `/play/`); it fetches the story's source from the play API |
| `/api/`        | the server, stories in the `stories` volume, metadata and logins in MySQL                          |

```bash
cp docker/.env.example docker/.env               # then set DB_PASSWORD and MYSQL_ROOT_PASSWORD (and GIT_TOKEN_KEY for git)
make prod-up SITE_ADDRESS=stories.example.com   # on the host; DNS must point at it for the certificate
make prod-logs
make prod-down                                  # keeps the volumes (stories, database, certificates)
```

`docker/.env` (gitignored) is needed by every `make prod-*` target. `SITE_ADDRESS` is the public host name (default `localhost`, which gets a certificate from Caddy's local CA). Only Caddy publishes ports. On start the server applies the migrations and seeds the example ([`Server.md`](Server.md#production)); back up the `stories` and `mysql` volumes.

Git support for stories (commit, push, pull and switch branches from the Visualizer, [`Server.md`](Server.md#git)) lets an author give a repository URL and access token when creating or editing a story on the landing page (a new connection pushes the story to `main`; branch, author and disconnect are in the Visualizer's git settings). It needs `GIT_TOKEN_KEY` in `docker/.env`: generate it once with `openssl rand -base64 32`. It encrypts the remote access tokens stored in the database. Without it the server runs with git unavailable (the Git button is hidden; `/api/health` says `"git":"unavailable"`). Keep it with the database backup: a lost or changed key cannot decrypt the stored tokens, and each connected story's token has to be entered again in its git settings. Set `GIT_ALLOWED_HOSTS` (e.g. `github.com,gitlab.com`) to limit the hosts a remote may point at; remotes are HTTPS only. A token is shared by everyone with the story's password, so use a fine-grained token scoped to that one repo.

The images are built with path-only cross-app links (`VITE_LANDING_URL=/`, `VITE_VISUALIZER_URL=/visualizer`, `VITE_ENGINE_URL=/play`, `VITE_PLAYER_URL=/play`), so they do not depend on the domain. Build variables:

| Env var           | Where        | Default | Meaning                                                                                                                                          |
| ----------------- | ------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `VISUALIZER_BASE` | Visualizer   | `/`     | Vite `base` of the build (`/visualizer/`, both slashes). Routing is the hash and API calls are the absolute `/api/…`, so only asset URLs change. |
| `LANDING_BASE`    | landing page | `/`     | Vite `base` of the build.                                                                                                                        |
| `PLAYER_BASE`     | SinglePlayer | `/`     | Vite `base` of the build (`/play/`). API calls are the absolute `/api/…`, so only asset URLs change.                                             |

The app image also builds the standalone player (`build:standalone`, one self-contained `index.html` with `base` `./`) and sets `SINGLE_PLAYER_STANDALONE_HTML` to it, so **Export for web** works ([`SinglePlayerStandalone.md`](SinglePlayerStandalone.md)).

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
    - next to it: `tsconfig.json` (the story's info and password hash are a database row, owned by the server)
    - edited by the author (directly, or through the Visualizer's other tabs)
    - also holds the story's art: each image is the `.png` next to the `.ts` file of the passage, character or npc it belongs to (`data/assets/story.png` is only the apps' favicon)

### Engine packages

- shared
    - shared code between services
    - time
    - the global engine types no author ever edits: `TPoint`/`TSize`/`TVec`, and the `<chapter>-<character>-<passage>` id format (`TPassageId`, `TPassageIdFor`)
    - the bottom of the stack: depends on nothing

- ui
    - the React pieces the front-ends need: theme, layout primitives, toasts, the global stylesheet, and `PasswordDialog` (the story password prompt of the landing page, the Visualizer and SinglePlayer)
    - exists so SinglePlayer, the Visualizer and MultiEngine look like one product instead of three, and so MUI is a detail of one package rather than a dependency of every app

- core
    - the headless story runtime: engine, story, processor, history, inventory, world state
    - no React, no rendering — it is the same runtime whether it runs in a browser tab (SinglePlayer), in a simulation (Visualizer) or on a server (MultiEngine), which is exactly why it cannot be owned by any one of them

- storyLoader (`@story/story-loader`)
    - runs a story's TypeScript source in the browser: fetches the files from a `TStorySource`, transpiles them (sucrase), runs them as CommonJS and loads `import()`ed chapters lazily; the story's `@story/shared` / `@story/core` are the app's own instances
    - used by SinglePlayer (and its standalone build); its limits are in `clients/shared/storyLoader/README.md`

### Services

- SinglePlayer
    - a service that can play the story for single player
    - only client implementation
    - fully implemented
    - plays the story named by `?story=<id>` (the landing page's **Play as single**, the Visualizer's **Play**); without it, a `play.json` next to the page (a standalone export, `src/source/StaticStorySource.ts`), else it goes to the landing page (`VITE_LANDING_URL`, default this host on 8103)
    - `src/main.tsx` loads the play manifest (`GET /api/stories/<id>/play`, `src/source/ServerStorySource.ts`); a private story answers `401` until the session holds its grant, so it shows the password dialog, logs in and retries (an editor coming from the Visualizer already has the grant). Then it sets the title and favicon, loads the story with `@story/story-loader` and starts the engine on it. A missing story shows an error with a link back to the landing page
    - one static build plays every story (plan D7 done): the story's TypeScript is fetched file by file from `GET /api/stories/<id>/play/<file>` and run in the browser; a chapter's passages are fetched when the chapter is first played. Images are the manifest's `.png` files, served by the same route

- MultiEngine
    - a service that can play the story for multiple players
    - `clients/MultiEngine/` is the client; multiplayer will be a module of the one server
    - the server will handle the world state and story progress, the client the ui
    - not implemented yet — the client is a scaffold, and there is no server part

- Visualizer
    - a service for creating and viewing the story and the world
    - used by the author of the game
    - splits into `clients/Visualizer/` (React app), `server/` (the NestJS server that holds every story under `stories/`, guards each with its password, and reads and writes the `.ts` files in its `data/` and `types/`), `protocol/` (the typed API contract both import) and `clients/LandingPage/` (the story list: create, edit, open, play, export, import)
    - implemented: map, timeline, chapter view and entities pages; the structure tab is future work
    - see [`clients/Visualizer/README.md`](../clients/Visualizer/README.md), [`Visualizer.md`](Visualizer.md) and [`Server.md`](Server.md)

## MultiEngine

- every player picks his character
- they are going throuh passages - waiting for each other on time
- moving between passages costs some time, player has to wait till everyone played prevoius pasages
- server that handles world state
