# Server

`server/` (`@story/server`) is the one backend: NestJS on Express, port **8123**, story metadata and logins in MySQL through TypeORM. It holds every story under `STORIES_ROOT`, guards each with its password, and reads and writes the `.ts` source in each story's `data/` and `types/` (ts-morph). The landing page, the Visualizer client and SingleEngine all reach it through their Vite `/api` proxies. The wire contract is `protocol/` (`@story/protocol`); what the editor routes do is in [`Visualizer.md`](Visualizer.md#api).

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
    database/          dataSourceOptions (shared by app + CLI), dataSource.ts (TypeORM CLI), entityRegistry, migrationRegistry, migrations/
    common/            @ProtocolRoute, @RouteParams, boot route check, JSON body/response interceptors, ApiExceptionFilter, HttpError
    health/            GET /api/health (+ DB ping)
    auth/              AuthController, SessionService (Session/SessionGrant entities), LoginLimiter, password (scrypt), cookie, CsrfGuard, StoryAccessGuard
    stories/           Story entity, StoryRepository, StoryFolders (create / import / export), zip, storyInput, StoriesController, StoryInfoController, importStoryFiles
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

- **Access levels** live in the protocol (`access` on every entry of `STORY_ROUTES` / `GLOBAL_ROUTES`, `protocol/src/routes.ts`): `public` (health, list, create, import, login, logout, session, `getStoryAccess`), `read` (every story `GET`, incl. events, images, source and export), `write` (every story `POST`/`PUT`/`DELETE`). The types enforce story `GET` = read, mutation = write.
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
- **Import** is `multipart/form-data`: the `zip` file plus the New-story fields minus the map size, which comes from the zip's `data/locations/map.json`. A `story.json` in an older zip is skipped unread. Refused (400): zip-slip paths, symlinks, encrypted or duplicate entries, unknown root entries, no valid map, > 50 MB zipped or > 200 MB unpacked.
- Loading a story rewrites a stale `tsconfig.json` and migrates an older story to the structure layout (`project/migrations/`), once.

### `stories:import-files` and the seed

```bash
yarn workspace @story/server stories:import-files [--seed <dir>]
```

Uses `STORIES_ROOT` and `DB_*`, runs pending migrations, then for every story folder: a legacy `story.json` is validated, upserted as the row, its tsconfig migrated, and the file deleted (an invalid one is reported and kept). Idempotent. With `--seed <dir>` (metadata from `server/seed/<basename>.story.json`): a folder without a row gets the seed row; a missing folder is copied from `<dir>` only when the database holds no story. Dev runs it on every `yarn dev:server` start with `stories/example`; prod runs it in the entrypoint.

## Environment

From `server/src/config/env.ts` (`ENV_SCHEMA`; an invalid value fails the boot with a readable message):

| Variable          | Default       | Meaning                                                                                                                                            |
| ----------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PORT`            | `8123`        | Listen port (on `0.0.0.0`).                                                                                                                        |
| `STORIES_ROOT`    | `stories`     | One folder per story; relative paths resolve against the repo root. SingleEngine's dev server reads the same variable: keep them equal.            |
| `DB_HOST`         | `mysql`       | MySQL host (the compose service). Use `127.0.0.1` outside docker.                                                                                  |
| `DB_PORT`         | `3306`        |                                                                                                                                                    |
| `DB_USER`         | `story`       |                                                                                                                                                    |
| `DB_PASSWORD`     | `story`       | Prod: from `docker/.env`.                                                                                                                          |
| `DB_NAME`         | `story`       | The tests always use `story_test` (see Tests).                                                                                                     |
| `COOKIE_SECURE`   | off           | `1` marks the cookie `Secure` (behind HTTPS).                                                                                                      |
| `TRUST_PROXY`     | off           | `1` keys the login limiter on the last `X-Forwarded-For` hop (the one the proxy wrote). Only when the server is reachable through the proxy alone. |
| `ALLOWED_ORIGINS` | the dev ports | Comma-separated origins a mutation may come from. Default: `http://localhost:<p>` and `http://127.0.0.1:<p>` for 8100, 8101, 8103, 8123.           |

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

**Gotcha: entities and migrations are registered by hand.** TypeORM loads globs with native `import()`, which bypasses the swc/Vitest transform, so `dataSourceOptions` takes explicit class lists. After `migration:generate`/`create`, add the class to `MIGRATIONS` in `database/migrationRegistry.ts`; a new entity goes into `ENTITIES` in `database/entityRegistry.ts` (the test truncation picks it up from there). Also:

- The generated `up`/`down` are `async` without `await` and fail `require-await`: keep the `await queryRunner.query(…)` calls (or return a promise).
- Entities rely on `strictPropertyInitialization: false` (no `!` on columns). `datetime(3|6)` create-date columns need an explicit `default: () => 'CURRENT_TIMESTAMP(n)'`.
- Avoid bidirectional relations between entity files: the import cycle breaks ESM loading (`Session` has no `@OneToMany` to `SessionGrant` for this reason).

## Tests

```bash
yarn vitest run --project server                         # in the dev container
DB_HOST=127.0.0.1 yarn vitest run --project server       # against a local MySQL
```

- Real MySQL, database **`story_test`**: `vitest.workspace.ts` forces `DB_NAME` (from `DB_TEST_NAME`, default `story_test`), and the helper refuses a name not ending in `_test`. The dev compose creates it (`docker/mysql/init/`, on a fresh volume only).
- Suites share that database and truncate it, so the `server` project runs its files in one fork, one after another.
- `__tests__/helpers/testApp.ts#createTestApp({ stories, watch, … })` boots the real `AppModule` on a temp `STORIES_ROOT` (copies of the example, rows seeded with password `example`), truncated tables, listening on a random port; it returns `{ base, project(id), story(id), stories, sessions, contexts, close }`. Never boot a test app on the real `stories/`. `overrideModules` swaps a feature module for a probe. `helpers/http.ts` has `requestJson`, `login`, `waitFor`.
- Don't run a dev server against `story_test` while the tests run.

## Adding a route

1. **Protocol** (`protocol/src/routes.ts`): add the entry to `STORY_ROUTES` (path relative to `/api/stories/:storyId`) or `GLOBAL_ROUTES` with `method`, `path` and `access`, its body and response in `TApiSpec`, DTOs in `protocol/src/dto/`. `CREATED_ROUTES` / `NO_CONTENT_ROUTES` for 201 / 204.
2. **Handler**: a method with `@ProtocolRoute('<name>')` in the feature's controller (`server/src/editor/<feature>/`; a new feature gets `<Feature>Module` + `<Feature>Controller`, imported in `AppModule`). Path, method and status come from the protocol. Take `@StoryCtx()`, `@RouteParams() params: THandlerParams<'<name>'>` (validated `kind`/`owner`), `@Body() body: TRouteBody<'<name>'>`, return `Promise<TRouteResponse<'<name>'>>`; put the logic in `project/` readers/writers.
3. **Boot check**: `ProtocolRouteCheck` fails startup (and every test app) when a protocol route has no handler, two handlers, or a handler names an unknown route. Access, CSRF, body, lease and errors need no per-route code.
4. Clients: `clients/Visualizer/src/api/types.ts`, `httpApi.ts` **and** `mockApi.ts`; the API table in [`Visualizer.md`](Visualizer.md#api).

## Production

`docker/docker-compose.prod.yml` runs the server from `/app/server` with the same loader, `COOKIE_SECURE=1`, `ALLOWED_ORIGINS=https://<SITE_ADDRESS>`, `TRUST_PROXY=1`, the `DB_*` secrets from `docker/.env` and `STORY_DB_SETUP=1`: the entrypoint applies the migrations, imports legacy `story.json` files of the `stories` volume and seeds the example. MySQL (`mysql:8.4`, volume `mysql`) is reachable only by the server; back up both volumes. How to deploy: [`README.md`](README.md#production).
