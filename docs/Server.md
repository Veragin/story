# Server

`server/` (`@story/server`) is the one backend: NestJS on Express, port **8123**, story metadata and logins in MySQL through TypeORM. It holds every story under `STORIES_ROOT`, guards each with its password, and reads and writes the `.ts` source in each story's `data/` and `types/` (ts-morph). The landing page, the Visualizer client and SinglePlayer all reach it through their Vite `/api` proxies. The wire contract is `protocol/` (`@story/protocol`); what the editor routes do is in [`Visualizer.md`](Visualizer.md#api).

It runs from source, no build step: `node --import @swc-node/register/esm-register` (swc emits the decorator metadata Nest's DI needs; tsx/esbuild cannot). Vitest uses `unplugin-swc` for the same reason.

## Running it

```bash
yarn dev:server                                   # http://localhost:8123, restarts on changes; needs MySQL
DB_HOST=127.0.0.1 yarn dev:server                 # outside the dev container, against a local MySQL
curl localhost:8123/api/health                    # {"ok":true,"service":"@story/server",…,"database":"up"}
```

`yarn dev` (and `make start`) runs it with the other services; in docker, `make up` + `make dev-server` runs it alone. The dev runner (`server/scripts/dev.ts`) first runs `stories:import-files --seed stories/example` (the example's database row), then starts `src/main.ts` and restarts it when `server/src`, `protocol/src` or `clients/shared/utils/src` change (chokidar: `node --watch` misses rename-saves under the swc hooks). Add a directory to `WATCHED` there when the server starts importing another workspace. `yarn workspace @story/server start` runs it once, without the seed or the watcher. Without a database, TypeORM retries for about 30 s and the server exits; the dev runner waits for the next change.

To try writes safely, point it at a copy: `STORIES_ROOT=<copy> PORT=<port> yarn dev:server`.

## Layout

```
server/
  src/
    main.ts            bootstrap: Express without Nest's body parser (common/expressApp.ts), shutdown hooks
    AppModule.ts       imports every module; global filter and the JSON interceptors
    config/            env.ts (ENV_SCHEMA, zod), AppConfigModule
    database/          DatabaseModule (exports DatabaseService + repositories; import it to touch the DB), entities/, repositories/,
                       dataSourceOptions (shared by app + CLI), dataSource.ts (TypeORM CLI), entityRegistry, migrationRegistry, migrations/
    common/            @ProtocolRoute, @RouteParams, boot route check, JSON body/response interceptors, ApiExceptionFilter, HttpError
    health/            GET /api/health (+ DB ping)
    auth/              AuthController, SessionService, LoginLimiter, password (scrypt), cookie, CsrfGuard, StoryAccessGuard
    stories/           StoryFolders (create / import / export), zip, storyInput, StoriesController, StoryInfoController, importStoryFiles
    storyContext/      StoryContexts (loaded stories, leases, idle eviction), StoryLeaseInterceptor, @StoryCtx()
    events/            EventBus (transactions), chokidar watcher, pathToEvent, SSE, EventsController
    editor/            one module + thin controller per feature: chapters passages triggers entities catalogs structure source images maps layouts projectInfo
    project/           framework-free ts-morph library: ProjectRoot, SourceProject, readers/, writers/, registry, validate, values, migrations/
    json/              map.json and *.layout.json stores, atomic write (tmp + rename)
  scripts/             dev.ts (watch runner), importStoryFiles.ts (CLI)
  seed/                example.story.json: the example story's row on a fresh database
  template/            the story "create story" copies (not server code; type-checked like a story)
  __tests__/           integration suites + helpers/
```

`project/`, `json/` and `events/` are plain libraries; the editor controllers are one-liners into them (`sp.run(() => readX(sp, …))`, `writeX(ctx, …)`).

## Request pipeline

For a protocol route, in this order (verified from the running app's enhancer lists):

1. **`UnmatchedStoryPathMiddleware`** (only `/api/stories/*` paths no protocol route matches): unknown story → 404 `No story`, no grant → 401, else Nest's `No route …` 404.
2. **`CsrfGuard`**: a mutation must send the route's content type (`application/json`; `multipart/form-data` for `importStory`), else 400, and an `Origin` in `ALLOWED_ORIGINS` or matching its `Host`, else 403. No `Origin` (curl) is allowed.
3. **`StoryAccessGuard`** (story routes): the route's `access` from the protocol decides (see Auth). Attaches the grant's expiry to the request (`storyGrant.ts`).
4. **`JsonResponseInterceptor`**: JSON answers become `JSON.stringify + '\n'` with `cache-control: no-store` (204s too); raw responses that already wrote headers (PNG, zip, SSE) are left alone.
5. **`JsonBodyInterceptor`**: reads the body only now, after the guards (20 MB limit, `Malformed JSON body: …`, must be an object; `PUT`/`DELETE` must carry a string `version`).
6. **`StoryLeaseInterceptor`** (story routes): loads the story (or reuses it) and holds a lease until the response settles; `@StoryCtx()` hands the handler `{ storyId, project, sp, bus }`. The event stream keeps its lease until the connection closes.
7. **`StoryVersionConflictInterceptor`**: a `StoryVersionConflictError` (story info written with a stale version) → 409 `stale` with the current info.
8. Handler (`@ProtocolRoute`), then **`ApiExceptionFilter`**: `HttpError` → its status and `TApiErrorBody`; Nest exceptions mapped to the same shape (`not_found`, `bad_request`, …); anything else is logged and answered 500 `internal`.

So a foreign origin or a locked story never gets its body parsed, and a 404/401 never loads a story.

## Auth

Per-story passwords; there are no user accounts.

- **Access levels** live in the protocol (`access` on every entry of `STORY_ROUTES` / `GLOBAL_ROUTES`, `protocol/src/routes.ts`): `public` (health, list, create, import, login, logout, session, `getStoryAccess`), `read` (every other story `GET`, incl. events, images, source and export), `write` (every story `POST`/`PUT`/`DELETE`, plus the editor-only `GET`s `getGit` and `getGitLog`). The types enforce story mutation = write; a story `GET` is read unless marked write.
- `StoryAccessGuard`: unknown story → 404; a grant for the story → pass; `read` on a `public` story → pass without a grant; else 401 `Story "x" is locked`. A public story's export carries no metadata or hash, so it is safe to read logged out.
- **Login** `POST /api/stories/:storyId/login {"password"}` checks the scrypt hash and sets the `story_session` cookie (HttpOnly, SameSite=Lax, `Secure` with `COOKIE_SECURE=1`). One cookie holds grants for several stories, 24 h each. Create and import log the creator in the same way.
- **Sessions in MySQL**: `session` stores only the SHA-256 of the token, `session_grant` one row per (session, story) with `expiresAt` (cascades on story delete). A restart keeps everyone logged in. Expired grants never count; they are pruned every 10 min.
- **Login limiter** (in memory): 10 wrong passwords per client and story within 10 min → 429. With `TRUST_PROXY=1` the client is the last `X-Forwarded-For` hop.
- An `/events` stream ends when its grant expires; a public read without a grant has no expiry.

By hand (the example's password is `example`):

```bash
curl -c jar -H 'content-type: application/json' -d '{"password":"example"}' localhost:8123/api/stories/example/login
curl -b jar localhost:8123/api/session
```

## Stories

A story is a folder `STORIES_ROOT/<id>/` (`tsconfig.json`, `data/`, `types/`) plus a `story` row (name, author, scrypt hash, map size, description, public, `version`). `GET /api/stories` lists them (no password; `unlocked` = your cookie holds its grant).

```bash
# create from server/template/ (201, logs you in; the id is a slug of the name)
curl -c jar -H 'content-type: application/json' localhost:8123/api/stories \
  -d '{"name":"My Story","author":"Me","password":"secret-1","description":"","mapSize":{"width":40,"height":30},"public":false}'
curl -b jar localhost:8123/api/stories/my-story/info             # info without the password, + version
curl -b jar -X PUT -H 'content-type: application/json' localhost:8123/api/stories/my-story/info \
  -d '{"version":"<version>","name":"Renamed","password":"new-secret"}'   # mapSize is read-only
curl -b jar -o my-story.zip localhost:8123/api/stories/my-story/export
curl -c jar -F zip=@my-story.zip -F name='My Copy' -F author=Me -F password=secret-2 -F description= -F public=false \
  localhost:8123/api/stories/import                                # 201, logs you in; the id is a slug of the name
```

- Limits (`STORY_LIMITS`, `protocol/src/dto/story.ts`): non-empty name, password ≥ 6 characters, each map side 1–500 tiles.
- The info `version` is the row's counter (`"1"`, `"2"`, …); a stale one is 409 `stale`.
- Create and import build the folder in a `.create-*` / `.import-*` temp dir, insert the row in a transaction, rename the folder, then commit; a failure leaves neither folder nor row. The server writes the story's `tsconfig.json` (engine paths are relative).
- **Export** holds only `tsconfig.json`, `data/` and `types/` (no metadata), plus a default `data/locations/map.json` when the story has none, so every export can be imported.
- **Export for web** (`/export/web`, same access) is the standalone player's `index.html` (read from `SINGLE_PLAYER_STANDALONE_HTML`; `503 unavailable` until it is built), the play manifest as `play.json`, and the story export: [`SinglePlayerStandalone.md`](SinglePlayerStandalone.md).
- **Import** is `multipart/form-data`: the `zip` file plus the New-story fields minus the map size, which comes from the zip's `data/locations/map.json`. A `story.json` in an older zip is skipped unread. Refused (400): zip-slip paths, symlinks, encrypted or duplicate entries, unknown root entries, no valid map, > 50 MB zipped or > 200 MB unpacked.
- Loading a story rewrites a stale `tsconfig.json` and migrates an older story to the structure layout (`project/migrations/`), once.

### `stories:import-files` and the seed

```bash
yarn workspace @story/server stories:import-files [--seed <dir>]
```

Uses `STORIES_ROOT` and `DB_*`, runs pending migrations, then for every story folder: a legacy `story.json` is validated, upserted as the row, its tsconfig migrated, and the file deleted (an invalid one is reported and kept). Idempotent. With `--seed <dir>` (metadata from `server/seed/<basename>.story.json`): a folder without a row gets the seed row; a missing folder is copied from `<dir>` only when the database holds no story. Dev runs it on every `yarn dev:server` start with `stories/example`; prod runs it in the entrypoint.

## Git

A story's folder can be its own git repository: whoever can edit the story connects it to a remote once (URL, branch, optional access token, commit identity), and the Visualizer's Git button then offers Commit & push, Pull, Switch branch and History. Code: `server/src/git/`, DTOs and limits in `protocol/src/dto/git.ts`, routes in [`Visualizer.md`](Visualizer.md#api).

- **One repo per story; the story folder is the repo root** (`STORIES_ROOT/<id>/.git`). It holds only the story's content. `stories/*` is ignored by the app repo, so the nested `.git` does not conflict; `stories/example` is committed in it, so `GIT_DISABLED_STORIES` (default `example`) refuses git for it.
- **Settings in MySQL**: table `story_git`, one row per connected story (`remoteUrl`, `branch`, `tokenEncrypted`, `authorName`, `authorEmail`, `version`), primary key `storyId` with a foreign key to `story` (`ON DELETE CASCADE`). Migration `AddStoryGit`.
- **Per story, not per user**: every route is `write` access (a grant for the story), the two `GET`s included, so a public story's readers never see the remote or the branches. The token belongs to the story: everyone with the story password pushes with it. Use a fine-grained token scoped to that one repo.
- **Availability**: git needs `GIT_TOKEN_KEY` and a working `git --version` (checked once at boot by `GitAvailability`, and logged; `node:22` ships git in the dev and prod images). Without them, or for a story in `GIT_DISABLED_STORIES`, `getGit` answers 200 `{ available: false, config: null, status: null }` and the client hides the button; every other git route answers 503 `git_unavailable`. `/api/health` reports `git: "up" | "unavailable"`.

### Token handling

```bash
openssl rand -base64 32        # a GIT_TOKEN_KEY: must decode to exactly 32 bytes, else the boot fails
```

- The token is encrypted at rest with AES-256-GCM (`tokenCipher.ts`) under `GIT_TOKEN_KEY` and stored in `story_git.tokenEncrypted` as `v1$<iv>$<tag>$<ciphertext>` (base64url). No token (`null`) means a public repo.
- It is never sent back: responses carry only `hasToken`. In `updateGitConfig`, an absent or empty `token` keeps the stored one and `null` clears it (the same rule as the story `password`).
- **Losing or changing the key** makes every stored token unreadable. The git settings stay; a git call that needs the token answers 409 `git_auth` ("enter the token again in the git settings") until someone re-enters it in the settings dialog. Keep the key with the database backup.
- It never reaches argv, `.git/config` or the logs. `GitRunner` passes it per process as env config: `GIT_CONFIG_COUNT=1`, `GIT_CONFIG_KEY_0=http.extraHeader`, `GIT_CONFIG_VALUE_0=Authorization: Basic base64(x-access-token:<token>)`, which GitHub, GitLab and Gitea personal access tokens accept. Command output and errors are scrubbed of the token (raw, URL-encoded and the Basic header) before they are logged or returned.

### `GitRunner`

The system `git` CLI through `execFile` (no shell, no git library). Every call:

- ignores the system and global git config (`GIT_CONFIG_NOSYSTEM=1`, `GIT_CONFIG_GLOBAL=/dev/null`) and drops every inherited `GIT_*` variable, so only the story's `.git` and the flags below count;
- never prompts: `GIT_TERMINAL_PROMPT=0`, empty `GIT_ASKPASS` / `SSH_ASKPASS`, `-c credential.helper=`;
- runs with `-c core.hooksPath=/dev/null -c core.fsmonitor=false -c commit.gpgSign=false -c protocol.allow=never -c protocol.https.allow=always` and `LC_ALL=C` (the error mapping reads English messages);
- times out after 60 s for network commands (fetch, push) and 10 s for local ones. Commit messages go in on stdin (`commit -F -`), the identity as `-c user.name=… -c user.email=…`.

Remote URLs (`gitRemote.ts`) must be `https://`, without credentials (`user:pass@`) or whitespace, at most 2048 characters, and on a host in `GIT_ALLOWED_HOSTS` when that is set. ssh, `file://` and `ext::` are refused.

### Flows

- **Setup** (`setupGit`, 201; 409 `exists` when already connected). `authorName` defaults to the story's author, `authorEmail` to `<storyId>@story.local`. The `story_git` row is saved only after git succeeded.
    - `initial: "push"`, the story becomes the repo's content: `git init -b <branch>` (unless a `.git` is there), a `.gitignore` (`node_modules/`, atomic-write temp files, `.create-*`, `.import-*`, `.git-setup-*`) unless one exists, `origin` set, the commit "Initial story", `push -u origin HEAD:<branch>`. A remote branch that already has commits answers 409 `git_rejected` (set up with `pull` instead). On failure, a `.git` the setup created is removed.
    - `initial: "pull"`, the repo's content replaces the story: init and fetch into a `.git-setup-*` temp folder under `STORIES_ROOT`, check out `origin/<branch>` (400 when the remote has no such branch), validate it like an import (`storyTree.ts`: `tsconfig.json`, `data/`, `types/`, besides `.git` and `.gitignore` no other root entries, no symlinks), then insert the row and swap the folders in one transaction (`StoryFolders.replace`: the old folder is moved aside and restored if the rename fails). The repo may lack `data/locations/map.json` (the stored map size is kept); an invalid one is 400. Then the reload below.
- **Commit & push** (`gitCommit { message, push }`): `git add -A`; nothing staged → 409 `git_nothing_to_commit`; commit. With `push`, `push -u origin HEAD`. A failed push keeps the local commit and answers 200 `pushed: false` with the error body in `pushError` (for `git_rejected` the client offers Pull, then push again). `gitPush` alone pushes the current branch (400 when detached).
- **Fetch** (`gitFetch`): `fetch --prune origin`; refreshes `ahead`/`behind` and the remote branches. `getGit` computes the status locally on each call and never fetches; `lastFetchedAt` is the mtime of `FETCH_HEAD`. The client fetches when the Git menu opens, at most once per 30 s.
- **Pull** (`gitPull`): needs a clean tree (409 `git_dirty`, the client offers Commit first) and an upstream (400). Fetch, then `merge --no-edit <upstream>`. Answers `{ updated, from, to, status }` (commit hashes).
- **Conflicts**: on a merge conflict the server runs `git merge --abort` and answers 409 `git_conflict` with the conflicting paths in `files`; the tree is as it was before the pull. There is no conflict resolution in the browser: the user commits on a new branch, or resolves outside the app.
- **Switch branch** (`gitCheckout { branch, create }`): needs a clean tree (409 `git_dirty`). `create: true` makes a new branch from HEAD (409 `exists` when the name is taken); else a local branch, or a remote one (a local tracking branch is created); else 404.
- **History** (`getGitLog`): newest first, with the changed files. Query `limit` (1–200, default 50) and `before` (a commit hash; the page starts at its parent, 404 when unknown). A repo without commits answers `[]`.
- **Settings** (`updateGitConfig`, versioned: a stale `version` is 409 `stale` with the current `TGitDto`): a new `remoteUrl` also rewrites `origin`. **Disconnect** (`deleteGitConfig { version, removeRepo }`, 204) deletes the row, and with `removeRepo` the story's `.git`.

### Reload after pull and checkout

A pull, a branch switch or a setup pull rewrites the story's files in bulk, `tsconfig.json` and the map size possibly included:

- git runs inside `bus.transaction(…)` (`events/rewriteInBulk.ts`), then `bus.settle()`. The rewritten files are marked with their current contents, so the watcher's reports are dropped and the editor gets no per-file change events, only the story event below;
- `StoryContexts.reload(storyId)` keeps the same context and bus (an open event stream holds its lease for as long as it is connected), swaps in a refresh that new requests wait for, reruns the tsconfig migration, re-arms the structure-layout migration and replaces the watcher (a setup pull renames the folder). It never waits on leases, the caller's included. Creating a new branch changes no files and skips the reload and the event;
- `data/locations/map.json` is re-read and `story.mapSize` updated (bumping the info `version`) when it differs; `mapSize` is read-only for clients but follows the files here, like an import. A missing or invalid map keeps the stored size;
- an `event: story` with `{ type: "story", reason: "git" }` goes to every open stream, and the Visualizer refetches all its stores (as after a reconnect).

### Locking and limits

- **Serialized per story**: `GitLocks` runs one git route of a story at a time (`getGit` included), so two commands never race for `.git/index.lock`. Editor writes are not blocked during a commit: a file written mid-commit just shows as a change afterwards.
- **Story folder operations**: an export holds only `tsconfig.json`, `data/` and `types/`, so `.git` is never zipped; an import zip with `.git/` is refused (unknown root entry); the watcher sees only `data/` and `types/`.
- **Limits** (`GIT_LIMITS`): commit message 1–5000 characters; branch name ≤ 255 characters, checked with `GIT_BRANCH_PATTERN` and `git check-ref-format --branch`; remote URL ≤ 2048; token ≤ 1024 and without control characters; author name and email ≤ 255, without `<`, `>` or control characters.
- Not in v1: ssh remotes, conflict resolution in the UI, auto-commit.

### Errors

Besides the usual `bad_request`, `not_found`, `exists` and `stale`:

| Status | `error`                 | When                                                                                                            |
| ------ | ----------------------- | --------------------------------------------------------------------------------------------------------------- |
| 409    | `git_not_configured`    | the story has no git settings, or its `.git` is gone (disconnect and set up again)                              |
| 409    | `git_dirty`             | pull or branch switch with uncommitted changes                                                                  |
| 409    | `git_conflict`          | the merge conflicted and was aborted; `files` lists the paths                                                   |
| 409    | `git_rejected`          | push rejected, the remote is ahead (pull first); setup push onto a non-empty branch                             |
| 409    | `git_auth`              | the remote refused the token, or the token cannot be decrypted with this key (not 401: the story is not locked) |
| 409    | `git_nothing_to_commit` | commit on a clean tree                                                                                          |
| 502    | `git_remote`            | network failure, timeout, unknown branch or any other remote error (scrubbed message)                           |
| 503    | `git_unavailable`       | no `GIT_TOKEN_KEY`, no `git`, or the story is in `GIT_DISABLED_STORIES`                                         |

## Environment

From `server/src/config/env.ts` (`ENV_SCHEMA`; an invalid value fails the boot with a readable message):

| Variable                        | Default              | Meaning                                                                                                                                                                                          |
| ------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `PORT`                          | `8123`               | Listen port (on `0.0.0.0`).                                                                                                                                                                      |
| `STORIES_ROOT`                  | `stories`            | One folder per story; relative paths resolve against the repo root. SinglePlayer's dev server reads the same variable: keep them equal.                                                          |
| `DB_HOST`                       | `mysql`              | MySQL host (the compose service). Use `127.0.0.1` outside docker.                                                                                                                                |
| `DB_PORT`                       | `3306`               |                                                                                                                                                                                                  |
| `DB_USER`                       | `story`              |                                                                                                                                                                                                  |
| `DB_PASSWORD`                   | `story`              | Prod: from `docker/.env`.                                                                                                                                                                        |
| `DB_NAME`                       | `story`              | The tests always use `story_test` (see Tests).                                                                                                                                                   |
| `COOKIE_SECURE`                 | off                  | `1` marks the cookie `Secure` (behind HTTPS).                                                                                                                                                    |
| `TRUST_PROXY`                   | off                  | `1` keys the login limiter on the last `X-Forwarded-For` hop (the one the proxy wrote). Only when the server is reachable through the proxy alone.                                               |
| `ALLOWED_ORIGINS`               | the dev ports        | Comma-separated origins a mutation may come from. Default: `http://localhost:<p>` and `http://127.0.0.1:<p>` for 8100, 8101, 8103, 8123.                                                         |
| `GIT_TOKEN_KEY`                 | unset                | 32 bytes in base64 (`openssl rand -base64 32`) that encrypt the stored git tokens. Unset: git is unavailable (see Git).                                                                          |
| `GIT_ALLOWED_HOSTS`             | any                  | Comma-separated host names a git remote may point at (`github.com,gitlab.com`). Set it in prod to limit SSRF.                                                                                    |
| `GIT_DISABLED_STORIES`          | `example`            | Comma-separated story ids that cannot be connected to git (the example is committed in this repo). An empty value enables every story.                                                           |
| `SINGLE_PLAYER_STANDALONE_HTML` | the standalone build | The player that **Export for web** zips: `clients/SinglePlayer/dist-standalone/index.html` (`build:standalone`); relative paths resolve against the repo root. Missing: that export answers 503. |

Outside the schema: `STORY_DB_SETUP=1` makes `docker/prod-entrypoint.sh` run the migrations and the import before starting (prod server service only); `DB_TEST_NAME` overrides the test database name.

## Database and migrations

`synchronize` is off everywhere; the schema changes only through migrations. `stories:import-files` runs the pending ones (dev before every server start, prod in the entrypoint), the app itself does not, and the test helper runs them per suite.

```bash
cd server   # or: yarn workspace @story/server <script>
yarn migration:show
yarn migration:run
yarn migration:revert
yarn migration:generate src/database/migrations/AddThing   # diff of entities vs. the database in DB_*
yarn migration:create src/database/migrations/AddThing     # empty
```

All go through the TypeORM CLI with the swc loader and `src/database/dataSource.ts` (prefix `DB_HOST=127.0.0.1` outside docker).

**Gotcha: entities and migrations are registered by hand.** TypeORM loads globs with native `import()`, which bypasses the swc/Vitest transform, so `dataSourceOptions` takes explicit class lists. After `migration:generate`/`create`, add the class to `MIGRATIONS` in `database/migrationRegistry.ts`; a new entity goes in `database/entities/`, into `ENTITIES` in `database/entityRegistry.ts`, and gets a repository in `database/repositories/` provided and exported by `DatabaseModule` (the test truncation picks it up from there). Also:

- The generated `up`/`down` are `async` without `await` and fail `require-await`: keep the `await queryRunner.query(…)` calls (or return a promise).
- Entities rely on `strictPropertyInitialization: false` (no `!` on columns). `datetime(3|6)` create-date columns need an explicit `default: () => 'CURRENT_TIMESTAMP(n)'`.
- Avoid bidirectional relations between entity files: the import cycle breaks ESM loading (`Session` has no `@OneToMany` to `SessionGrant` for this reason; `StoryGit` is 1:1 with `Story` through its primary key, as a one-sided `@ManyToOne`, since `@OneToOne` would add a redundant unique index).

## Tests

```bash
yarn vitest run --project server                         # in the dev container
DB_HOST=127.0.0.1 yarn vitest run --project server       # against a local MySQL
```

- Real MySQL, database **`story_test`**: `vitest.workspace.ts` forces `DB_NAME` (from `DB_TEST_NAME`, default `story_test`), and the helper refuses a name not ending in `_test`. The dev compose creates it (`docker/mysql/init/`, on a fresh volume only).
- Suites share that database and truncate it, so the `server` project runs its files in one fork, one after another.
- `__tests__/helpers/testApp.ts#createTestApp({ stories, watch, … })` boots the real `AppModule` on a temp `STORIES_ROOT` (copies of the example, rows seeded with password `example`), truncated tables, listening on a random port; it returns `{ base, project(id), story(id), stories, sessions, contexts, close }`. Never boot a test app on the real `stories/`. `overrideModules` swaps a feature module for a probe. `helpers/http.ts` has `requestJson`, `login`, `waitFor`.
- Don't run a dev server against `story_test` while the tests run.
- Git is unavailable in a test app unless `createTestApp({ git })` overrides the git options; `helpers/git.ts` has `TEST_GIT_OPTIONS` (a test key, `allowFileRemotes`) and temp bare repos as `file://` remotes. `allowFileRemotes` (env `GIT_ALLOW_FILE_REMOTES=1`) is test-only: `gitRemote` then accepts `file://` and `GitRunner` adds `-c protocol.file.allow=always`. Never set it in prod.

## Adding a route

1. **Protocol** (`protocol/src/routes.ts`): add the entry to `STORY_ROUTES` (path relative to `/api/stories/:storyId`) or `GLOBAL_ROUTES` with `method`, `path` and `access`, its body and response in `TApiSpec`, DTOs in `protocol/src/dto/`. `CREATED_ROUTES` / `NO_CONTENT_ROUTES` for 201 / 204.
2. **Handler**: a method with `@ProtocolRoute('<name>')` in the feature's controller (`server/src/editor/<feature>/`; a new feature gets `<Feature>Module` + `<Feature>Controller`, imported in `AppModule`). Path, method and status come from the protocol. Take `@StoryCtx()`, `@RouteParams() params: THandlerParams<'<name>'>` (validated `kind`/`owner`), `@Body() body: TRouteBody<'<name>'>`, return `Promise<TRouteResponse<'<name>'>>`; put the logic in `project/` readers/writers.
3. **Boot check**: `ProtocolRouteCheck` fails startup (and every test app) when a protocol route has no handler, two handlers, or a handler names an unknown route. Access, CSRF, body, lease and errors need no per-route code.
4. Clients: `clients/Visualizer/src/api/types.ts`, `httpApi.ts` **and** `mockApi.ts`; the API table in [`Visualizer.md`](Visualizer.md#api).

## Production

`docker/docker-compose.prod.yml` runs the server from `/app/server` with the same loader, `COOKIE_SECURE=1`, `ALLOWED_ORIGINS=https://<SITE_ADDRESS>`, `TRUST_PROXY=1`, the `DB_*` secrets and `GIT_TOKEN_KEY` (plus the optional `GIT_ALLOWED_HOSTS`) from `docker/.env` and `STORY_DB_SETUP=1`: the entrypoint applies the migrations, imports legacy `story.json` files of the `stories` volume and seeds the example. MySQL (`mysql:8.4`, volume `mysql`) is reachable only by the server; back up both volumes, and keep `GIT_TOKEN_KEY` with the database backup (without it the stored git tokens must be re-entered). Without `GIT_TOKEN_KEY` the server runs with git unavailable. How to deploy: [`README.md`](README.md#production).
