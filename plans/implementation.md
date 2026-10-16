# Server refactor — implementation plan

Source brief: [`plan.md`](./plan.md). This file turns it into ordered, verifiable phases.

## 0. Where we start (current state, verified in code)

| Area                 | Today                                                                                                                                                                                                                                                          |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Visualizer server    | `Visualizer/server` — raw `node:http`, hand-written `Router` driven by the protocol route tables, run by `tsx`. ~10k LOC, of which ~7k is `project/` (ts-morph readers/writers over story source files). 18 integration test suites (HTTP against a temp copy). |
| Protocol             | `Visualizer/protocol` (`@story/visualizer-protocol`) — `STORY_ROUTES` / `GLOBAL_ROUTES` (method + path), `TApiSpec` (body/response per route), DTOs, error codes. Used by server, Visualizer client, landing page.                                              |
| Story metadata       | `stories/<id>/story.json` (name, author, scrypt password hash, mapSize, description, public). `version` = hash of the file text (optimistic concurrency).                                                                                                       |
| Story content        | `stories/<id>/{data,types,tsconfig.json}` — TS source. **Stays on disk**; the brief only moves the metadata to the DB.                                                                                                                                          |
| Auth                 | In-memory `SessionStore` (cookie `story_session`, 24 h grant per story), `LoginLimiter`, CSRF origin/content-type check. Every story route needs a grant, except images of a public story.                                                                      |
| SingleEngine         | Gets story code straight from disk through a Vite plugin (`SingleEngine/vite/storiesPlugin.ts`); its guard asks the server `GET /api/stories/:id/access`.                                                                                                       |
| MultiEngine server   | `MultiEngine/server` — a 501 scaffold on :8124.                                                                                                                                                                                                                 |
| Docker               | `docker-compose.yml` (root, dev), `docker-compose.prod.yml` (root, Caddy + server + engine), `docker/` holds Dockerfiles, Caddyfile, entrypoint. No database.                                                                                                   |

## 1. Decisions

Confirmed by the user on 2026-10-13: D1, D2, D3 (amended: export carries no story metadata), D4 (follows from D3), D5, D6, D9. D7, D8 and D10 are still defaults.

| #   | Question                                                                       | Default in this plan                                                                                                                                                                                                                                                                       |
| --- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Where do `core/`, `shared/` (`@story/shared`), `ui/` go? Not listed in brief.  | **Confirmed.** `clients/shared/{core,utils,ui}` — three workspaces, package names unchanged (`@story/core`, `@story/shared`, `@story/ui`). The server keeps importing `@story/shared` (11 imports). |
| D2  | Where does the landing page go?                                                | **Confirmed.** `clients/LandingPage/` (its own client; it is not part of the Visualizer app). |
| D3  | "Read if public" — which reads?                                                | **Confirmed.** Every `GET` story route of a **public** story is readable without a login, `exportStory` included. That's safe because the zip no longer contains `story.json` or the password hash (D4). Private story: everything needs a grant (as today). The Visualizer client keeps asking for the password to edit; a read-only UI mode is out of scope. |
| D4  | What happens to `story.json` and the zip format? | **Confirmed.** `story.json` disappears from story folders **and from the export zip**: the DB is the only place for story metadata. A zip is just story content: `tsconfig.json`, `data/`, `types/`. **Import** therefore takes the metadata from the request, like `createStory`: name, author, description, public, password. `mapSize` comes from the zip's `data/locations/map.json` (`width`/`height`). The story id is a slug of the name, like `createStory`, and the importer gets a grant. When an older zip still has `story.json`, it is skipped without being read: its hash is never trusted. |
| D5  | Sessions                                                                       | **Confirmed.** Persisted in MySQL (tokens stored as SHA-256 hashes). A restart no longer logs everyone out. Login limiter stays in memory.                                                                                                                                                                 |
| D6  | MultiEngine server                                                             | **Confirmed.** Deleted (scaffold only). Port 8124 freed. A `multiplayer/` module is **not** created now.                                                                                                                                                                                                   |
| D7  | Protocol package name                                                          | `@story/protocol` (it now describes the one server, not just the Visualizer).                                                                                                                                                                                                               |
| D8  | How SingleEngine gets story code                                               | Unchanged (Vite plugin reads from disk, asks the server for access). Serving a compiled story bundle from the server is a follow-up.                                                                                                                                                         |
| D9  | Tests and the database                                                         | **Confirmed.** Integration tests run against real MySQL (the dev compose service, database `story_test`), not SQLite — no dialect drift.                                                                                                                                                                   |
| D10 | Runtime for decorators                                                         | `@swc-node/register` (see §3 risk R1). Validated by the Phase 3 spike before anything is ported.                                                                                                                                                                                             |

## 2. Target layout

```
stories/                 unchanged (minus story.json per story after migration)
docker/
  docker-compose.yml     dev (moved from root), + mysql service
  docker-compose.prod.yml + mysql service
  Dockerfile.dev  Dockerfile.prod  Caddyfile  prod-entrypoint.sh
docs/
protocol/                @story/protocol  (ex Visualizer/protocol) + per-route access level
server/                  @story/server    NestJS, the only server
  src/
    main.ts              bootstrap (listen, shutdown hooks)
    AppModule.ts
    config/              env schema + typed config
    database/            dataSource.ts (shared by app + TypeORM CLI), migrations/, entities registry
    common/              ApiExceptionFilter, ProtocolRoute decorator, CSRF guard, body helpers
    health/              HealthModule
    auth/                AuthModule: AuthController, SessionService, PasswordService, LoginLimiter, StoryAccessGuard
    stories/             StoriesModule: StoriesController, StoryInfoController, StoryRepository, StoryFolders, zip
    storyContext/        StoryContextModule: StoryContexts (lease/evict), StoryLeaseInterceptor, @StoryCtx() param
    events/              EventsModule: SSE controller, EventBus, watcher
    project/             plain library ported 1:1 (ProjectRoot, SourceProject, readers/, writers/, migrations/) — not Nest-ified
    editor/              one Nest module per feature, thin controllers over project/:
      chapters/ passages/ triggers/ entities/ structure/ catalogs/ source/ images/ maps/ layouts/ projectInfo/
  template/              ex Visualizer/server/template
  __tests__/
clients/
  Visualizer/            ex Visualizer/client
  LandingPage/           ex Visualizer/landing-page
  SingleEngine/          ex SingleEngine
  MultiEngine/           ex MultiEngine/client
  shared/                core/ utils/ ui/   (D1)
```

## 3. Risks to settle early

- **R1 — decorator metadata.** Nest DI relies on `emitDecoratorMetadata`; `tsx`/esbuild (used today) and Vitest (esbuild) do not emit it. Plan: run with `node --import @swc-node/register/esm-register src/main.ts` (keeps the repo's "source-only, no build step" rule, also transpiles the workspace TS packages), and add `unplugin-swc` to the server's Vitest project. TypeORM CLI runs through the same loader. Fallback if ESM + swc fights back: compile `server/` to CJS with `nest build -b swc`.
- **R2 — the server needs its own tsconfig program.** It needs `experimentalDecorators` + `emitDecoratorMetadata` and node libs; the root `tsc -p tsconfig.json` program is browser-lib. Remove server paths from the root `include`, add `tsc --noEmit -p server/tsconfig.json` to `yarn typecheck`.
- **R3 — moving `core/shared/ui` breaks every story's `tsconfig.json`.** Each story's tsconfig holds repo-relative `paths` to them (`storyFolders.ts#storyTsconfig`), the server's ts-morph validation uses that tsconfig, and runtime stories live on a volume outside git. Mitigation: on story load, the server rewrites a story's `tsconfig.json` when it differs from the generated one (idempotent, mirrors the existing `migrateStructureLayout` hook), plus the import command (Phase 4) does it for all stories.
- **R4 — wire compatibility.** Clients depend on exact paths, status codes (201/204), error body shape (`TApiErrorBody`), `version` semantics, SSE format, cookie name/flags. Keep them byte-compatible; the ported test suites are the contract.
- **R5b — import contract changes (D4).** `importStory` stops being `?id=` + a raw zip body. It becomes `multipart/form-data` (`zip` file + the metadata fields), which the landing page has to follow: its Import dialog now asks for the same fields as **New story**, minus the map size. This is the only client-visible API change in the refactor. Ship the client and server changes in the same phase.
- **R5 — story row ↔ folder consistency.** Create/import touch both FS and DB. Order: build folder in a dot-temp dir → insert row in a transaction → rename folder → commit; on failure remove the temp dir / roll back.
- **R6 — uncommitted `docker-compose.yml` edits** on the working tree; commit them before Phase 2 moves the file.

## 4. Phases

Every phase ends green: `yarn typecheck && yarn lint && yarn test`, and `make start` serves all clients. Commit per phase.

### Phase 1 — Folder restructure (no behavior change)

1. `git mv` per §2: `Visualizer/protocol → protocol`, `Visualizer/client → clients/Visualizer`, `Visualizer/landing-page → clients/LandingPage`, `SingleEngine → clients/SingleEngine`, `MultiEngine/client → clients/MultiEngine`, `core|shared|ui → clients/shared/{core,utils,ui}`. Leave `Visualizer/server` in place for now (it is replaced, not moved). Delete `MultiEngine/server` (D6).
2. Rename `@story/visualizer-protocol → @story/protocol` (package.json + imports, codemod with `grep -rl | xargs sed`).
3. Fix every path reference: root `package.json` workspaces + scripts, `tsconfig.json` paths/include/exclude, `tsconfig.node.json`, `vitest.workspace.ts`, `eslint.config.js` (incl. `import/no-restricted-paths` zones for stories), `scripts/typecheck-stories.mjs`, each vite config (`at('../shared')` etc.), `Makefile`, `Dockerfile.prod`, `docker-compose.prod.yml` working dirs, `docs/`, READMEs.
4. Story tsconfig paths: update `storyTsconfig()` + `stories/example/tsconfig.json` + `template/tsconfig.json`; add the rewrite-on-load migration (R3).
5. Verify: typecheck, lint, all tests, `make start`, open landing → Visualizer → play the example.

### Phase 2 — Docker

1. Commit the pending `docker-compose.yml` change (R6), then `git mv` both compose files into `docker/`. Paths become relative to `docker/`: `build.context: ..`, `volumes: ..:/app`. Add top-level `name: story-template` so container/volume names do not change with the directory.
2. `Makefile`: `COMPOSE = docker compose -f docker/docker-compose.yml`, `PROD_COMPOSE = docker compose -f docker/docker-compose.prod.yml`. Drop port 8124 and the `dev-multi-engine-server` target.
3. Add `mysql` (image `mysql:8.4`, named volume, healthcheck `mysqladmin ping`, `MYSQL_DATABASE=story`, an init script creating `story_test` for tests). Dev: publish 3306 only if needed by host tools. Dev container gets `DB_HOST=mysql` etc. and `depends_on: mysql (healthy)`.
4. Prod: same service, no published port, secrets via `.env` (`DB_PASSWORD`, `MYSQL_ROOT_PASSWORD`), server `depends_on: mysql (healthy)`.
5. Verify: `make start`, `docker compose exec mysql mysql -e 'show databases'`.

### Phase 3 — Nest skeleton + toolchain spike

1. `server/package.json` (`@story/server`): `@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express`, `@nestjs/config`, `@nestjs/typeorm`, `typeorm`, `mysql2`, `reflect-metadata`, `@swc-node/register`, `@swc/core`; dev: `unplugin-swc`, `@nestjs/testing`. Carry over `chokidar`, `fflate`, `prettier`, `ts-morph`.
2. `server/tsconfig.json` (decorators, node libs) + root typecheck wiring (R2). Vitest project `server` with `unplugin-swc`.
3. `main.ts`, `AppModule`, `ConfigModule` with a validated env schema (`PORT`, `STORIES_ROOT`, `DB_*`, `COOKIE_SECURE`, `ALLOWED_ORIGINS`, `TRUST_PROXY`). Global prefix none — protocol paths already carry `/api`.
4. `HealthModule` → `GET /api/health` returning `THealthDto` (+ DB ping).
5. `database/dataSource.ts` + one empty migration; scripts `migration:generate|run|revert|show` through the swc loader.
6. Exit criteria for the spike (R1): dev watch reload works, DI resolves without explicit `@Inject`, a Vitest test boots the app via `Test.createTestingModule`, `migration:run` works. If any fails, switch to the fallback before continuing.
7. Run on **:8125** next to the old server while porting; the clients still point at 8123.

### Phase 4 — Database: stories

1. Entity `Story`: `id varchar(64) PK` (slug, same rule as `isStoryId`), `name`, `author`, `passwordHash`, `mapWidth`, `mapHeight`, `description text`, `isPublic`, `version int` (`@VersionColumn`, exposed as `TVersion` string), `createdAt`, `updatedAt`.
2. Migration `CreateStory`. `synchronize: false` everywhere. Dev runs pending migrations on boot (`migrationsRun: true`); prod runs `migration:run` in `prod-entrypoint.sh` before `exec`.
3. `StoryRepository` with the operations `StoryStore` has today (`exists`, `read`, `readVersioned`, `list` sorted by name/id, `write` with version check) so callers port 1:1. `exclusive()` becomes a transaction with the version check (`UPDATE … WHERE version = ?`).
4. Command `yarn workspace @story/server stories:import-files`: scans `STORIES_ROOT`, validates each `story.json` with the existing `parseStoryFile`, upserts the row, rewrites the story tsconfig (R3), then deletes `story.json`. Idempotent. The prod entrypoint's "seed example" step becomes: copy the example folder + run this command; the example keeps a committed `story.json` **as seed input only** (or a seed migration — pick during implementation).
5. Tests: repository CRUD + version conflict, import command on a temp stories root.

### Phase 5 — Protocol: access levels + route decorator

1. Add `access: 'public' | 'read' | 'write'` to every entry of `STORY_ROUTES` / `GLOBAL_ROUTES` (single source of truth for D3):
    - `public`: `health`, `listStories`, `createStory`, `importStory`, `login`, `logout`, `getSession`, `getStoryAccess`.
    - `read`: every story `GET` (incl. `events`, images, `getSource`, `exportStory`).
    - `write`: every story `POST`/`PUT`/`DELETE`.
2. `common/ProtocolRoute.ts`: `@ProtocolRoute('getChapter')` = `applyDecorators(Get(fullPath), SetMetadata(ROUTE_KEY, name), HttpCode(201|204 from CREATED_/NO_CONTENT_ROUTES))`. Paths come from the protocol, so controllers cannot drift. Story routes use `storyApiPrefix(':storyId') + path`.
3. Startup check (replaces `Router.assertComplete`): via `DiscoveryService`, every protocol route name has exactly one handler; fail boot otherwise. Unit test it.
4. Update the protocol's `structure.test.ts` to assert every route has an access level.

### Phase 6 — Auth

1. Entities + migration: `Session (id, tokenHash unique, createdAt, lastSeenAt)`, `SessionGrant (sessionId FK cascade, storyId FK cascade, expiresAt, PK(sessionId, storyId))`.
2. `SessionService` with today's `SessionStore` API (`grant`, `expiresAt`, `storyIds`, `revoke`, `prune`) on the DB; prune on an interval (`@nestjs/schedule`) and lazily on read. Cookie helpers and `PasswordService` (scrypt, caps) ported unchanged; `LoginLimiter` ported unchanged (in memory).
3. Guards (global, in this order):
    - `CsrfGuard` — port of `assertSafeMutation` (content-type + origin), reads the route name from metadata.
    - `StoryAccessGuard` — for story routes: 404 if no story row; `public` → pass; `read` → grant **or** `story.isPublic`; `write` → grant. Attaches the grant (for `endAtExpiry` on long-lived responses) to the request.
4. `AuthController`: `login`, `logout`, `getSession`, `getStoryAccess` (`canEdit` = grant, `canPlay` = grant or public).
5. Tests: port `auth.test.ts`, `trustProxy.test.ts`, `multiUser.test.ts`; add the access matrix (public/private × read/write × with/without/expired grant; export of a public story without login succeeds) and "session survives app restart".

### Phase 7 — Common HTTP behavior

1. `ApiExceptionFilter`: `HttpError` → its status + `TApiErrorBody`; Nest `HttpException` (404 no route, body parse errors, payload too large) → mapped `TApiErrorBody`; unknown → 500 `internal`. Keep `HttpError` as is (domain code throws it).
2. Body handling: JSON parser with today's limits; `multipart/form-data` for `importStory` (`FileInterceptor` / multer, file limit `MAX_STORY_ZIP_BYTES`; `CsrfGuard` expects `multipart/form-data` for that route); a `VersionedBodyPipe` for PUT/DELETE (`version` must be a string — today's router rule); "body must be a JSON object" check. Validation of bodies stays in the existing writer code (no class-validator — the DTOs are protocol types, not classes).
3. Response headers: `cache-control: no-store` on JSON, as today (interceptor).
4. Tests: port `router.test.ts` to assert the same wire behavior through Nest.

### Phase 8 — Stories module

1. `StoriesController` (`listStories` with `unlocked`, `createStory` → grant + cookie, `importStory`), `StoryInfoController` (`getStoryInfo`, `updateStoryInfo` with version, `exportStory` — zip of `tsconfig.json`, `data/`, `types/` only).
2. `StoryFolders`: port `storyFolders.ts`/`zip.ts`/`storyInput.ts`; create/import follow R5. `zip.ts`: drop `story.json` from `TOP_FILES` and from the "must contain" check. On import, a `story.json` entry is skipped without being read.
3. Import (D4, R5b): the body is parsed with the same validation as `createStory` (`parseCreateStoryBody` minus `mapSize`). `mapSize` is read from the zip's `data/locations/map.json` through the existing map parser; a zip without a valid map is `400`. The id is a slug of the name via `freeId`, the importer gets a grant and a cookie, and the response is `201 TStoryDto`.
4. Protocol: `TImportStoryBody = Omit<TCreateStoryBody, 'mapSize'>` (the multipart fields), `STORY_ZIP_CONTENT_TYPE` stays for the export response, and the `importStory` route moves out of `RAW_BODY_ROUTES`. Update the doc comment in `TApiSpec`.
5. Landing page: `api.importStory(zip, fields)` sends `FormData`. The Import dialog reuses the **New story** form without the map size, so the "taken id → ask for another" step goes away (the id is a slug, as for create). Update its tests.
6. Tests: port `stories.test.ts`, `storiesApi.test.ts`; add "export has no story.json", "export → import round-trip keeps content and map size", "legacy zip with story.json imports and ignores it", "failed DB insert leaves no folder".

### Phase 9 — Story context + editor modules

1. Move `project/`, `json/`, `events/` (EventBus, watcher, pathToEvent, version) into `server/src` **unchanged** apart from imports. They are framework-free and well tested; Nest-ifying them adds risk without benefit.
2. `StoryContextModule`: `StoryContexts` as a provider (idle eviction, closed on `onApplicationShutdown`); `StoryLeaseInterceptor` acquires a lease for story routes and releases it in `finalize`; `@StoryCtx()` param decorator hands controllers the `TServerContext` (`project`, `SourceProject`, `bus`). The `migrateStructureLayout` first-run hook and the tsconfig rewrite (R3) run on load.
3. One module + thin controller per feature, each handler a one-liner into `project/` exactly like today's `routes/*.ts`: chapters, passages, triggers, entities, structure (types + literals), catalogs, source, images (raw PNG + etag), maps (map size from the story row), layouts, projectInfo.
4. `EventsController`: SSE via `@Res()` + the existing `openEventStream` (keeps the exact event format); the response ends at grant expiry (`endAtExpiry`) — for a public story read without grant, no expiry.
5. Tests: port the remaining suites (`structure*`, `source*`, `catalogs`, `images`, `jsonStores`, `bus`, `pathToEvent`, `jsDoc`, `atomicWrite`). `helpers.ts` gets a `createTestApp()` that returns the same `TApp`-like shape (`listen`, `close`, `story(id)`, `stories`) so test bodies change minimally; it uses a temp stories root + the `story_test` database, truncated per suite.

### Phase 10 — Cut-over

1. New server takes port **8123**; delete `Visualizer/server` (and the empty `Visualizer/`, `MultiEngine/` dirs).
2. Clients: protocol import rename already done; rename the proxy env `VISUALIZER_SERVER → STORY_SERVER` in all vite configs and the SingleEngine guard; `DEV_PORTS` in CSRF loses nothing (8100, 8101, 8103, 8123).
3. Prod: `docker-compose.prod.yml` server service → `working_dir /app/server`, command via swc loader, DB env; entrypoint runs migrations + import command; engine service paths updated; Dockerfile.prod build paths for LandingPage/Visualizer.
4. Verify end to end in dev and with `make prod-up` on localhost: create story, log in, edit, SSE refresh, export (zip has no `story.json`) → import with new name/password, play public story logged out, private story asks for password, restart server → still logged in.

### Phase 11 — Docs

`docs/README.md` (layout, ports table without 8124, getting started incl. MySQL + migrations), new `docs/Server.md` (modules, auth model, env vars, migrations workflow) replacing the server half of `Visualizer/README.md`; client READMEs move with their folders.

## 5. Conventions to hold while porting (from `CLAUDE.md`)

- Files: `StoriesController.ts`, `SessionService.ts`, `StoryAccessGuard.ts` (one primary export → PascalCase); `auth/`, `stories/` lowercase folders. Module classes in `<Name>Module.ts`. No `index.ts` barrels inside `server/`.
- Named exports only; arrow functions for non-class code; `async/await`; types `T*`, interfaces `I*`.
- No `as` / `!`: the current `Router` casts disappear with Nest; route param typing comes from `TRouteParams<'name'>` on `@Param()` via a small typed decorator.
- No JSDoc except the protocol's public API (shared internal package).

## 6. Out of scope

MultiEngine server/multiplayer, a read-only Visualizer UI, serving compiled story bundles to SingleEngine (D8), moving story content (passages etc.) into the DB, user accounts (auth stays per-story password).
