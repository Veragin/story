# Server

`server/` (`@story/server`) is the one backend: NestJS on Express, port **8154**, story metadata and logins in MySQL through TypeORM. It holds every story under `STORIES_ROOT`, guards each with its password, and reads and writes the `.ts` / `.tsx` source in each story's `data/` and `types/` (ts-morph). The landing page, the Visualizer client and SinglePlayer all reach it through their Vite `/api` proxies. The wire contract is `protocol/` (`@story/protocol`); what the editor routes do is in [`Visualizer.md`](Visualizer.md#api).

It runs from source, no build step: `node --import @swc-node/register/esm-register` (swc emits the decorator metadata Nest's DI needs; tsx/esbuild cannot). Vitest uses `unplugin-swc` for the same reason.

## Running it

```bash
yarn dev:server                                   # http://localhost:8154, restarts on changes; needs MySQL
DB_HOST=127.0.0.1 yarn dev:server                 # outside the dev container, against a local MySQL
curl localhost:8154/api/health                    # {"ok":true,"service":"@story/server",…,"database":"up"}
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
    auth/              AuthController, PasswordResetController, SessionService, LoginLimiter, password (scrypt), cookie, CsrfGuard, StoryAccessGuard
    mail/              MailModule, Mailer (nodemailer over SMTP_URL, or a log line without it)
    stories/           StoryFolders (create / import / export), zip, storyInput, StoriesController, StoryInfoController, importStoryFiles
    storyFiles/        StoryFilesController (addStoryFiles: a zip's files into a live story)
    storyContext/      StoryContexts (loaded stories, leases, idle eviction), StoryReloader (after a bulk rewrite), StoryLeaseInterceptor, @StoryCtx()
    events/            EventBus (transactions), chokidar watcher, pathToEvent, SSE, EventsController
    editor/            one module + thin controller per feature: chapters passages triggers entities catalogs structure source engine images maps layouts projectInfo
    project/           framework-free ts-morph library: ProjectRoot, SourceProject, readers/, writers/, registry, validate, values, migrations/
                       (reading and writing classes, types and literals: Visualizer.md, "Story file conventions")
    json/              map.json and *.layout.json stores, atomic write (tmp + rename)
    ai/                AiModule: the story's Claude Code agent and Gemini image generation (see AI agent); stories/StoryLifecycle is its folder-swap hook
  aiLauncher/          the AI launcher sidecar: plain Node http, the only holder of the docker socket and the Gemini key (see AI agent)
  ai/agent/            the agent's CLAUDE.md, settings.json, skills/ and tsconfig.json, baked into docker/Dockerfile.ai
  scripts/             dev.ts (watch runner), importStoryFiles.ts (CLI), aiEnable.ts (ai:enable)
  seed/                <id>.story.json per seeded story (example, demo): its row on a fresh database
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
5. **`JsonBodyInterceptor`**: reads the body only now, after the guards (20 MB limit, `Malformed JSON body: …`, must be an object; `PUT`/`DELETE` must carry a string `version`, except `resetPassword`).
6. **`StoryLeaseInterceptor`** (story routes): loads the story (or reuses it) and holds a lease until the response settles; `@StoryCtx()` hands the handler `{ storyId, project, sp, bus }`. The event stream keeps its lease until the connection closes.
7. **`StoryVersionConflictInterceptor`**: a `StoryVersionConflictError` (story info written with a stale version) → 409 `stale` with the current info.
8. Handler (`@ProtocolRoute`), then **`ApiExceptionFilter`**: `HttpError` → its status and `TApiErrorBody`; Nest exceptions mapped to the same shape (`not_found`, `bad_request`, …); anything else is logged and answered 500 `internal`.

So a foreign origin or a locked story never gets its body parsed, and a 404/401 never loads a story.

## Auth

Per-story passwords; there are no user accounts.

- **Access levels** live in the protocol (`access` on every entry of `STORY_ROUTES` / `GLOBAL_ROUTES`, `protocol/src/routes.ts`): `public` (health, list, create, import, login, logout, session, `getStoryAccess`, `requestPasswordReset`, `resetPassword`), `read` (every other story `GET`, incl. events, images, source and export), `write` (every story `POST`/`PUT`/`DELETE`, plus the editor-only `GET`s `getGit`, `getGitBranches`, `getAi`, `aiEvents` and `listAiSessions`). The types enforce story mutation = write; a story `GET` is read unless marked write.
- `StoryAccessGuard`: unknown story → 404; a grant for the story → pass; `read` on a `public` story → pass without a grant; else 401 `Story "x" is locked`. A public story's export carries no metadata or hash, so it is safe to read logged out.
- **Login** `POST /api/stories/:storyId/login {"password"}` checks the scrypt hash and sets the `story_session` cookie (HttpOnly, SameSite=Lax; with `COOKIE_SECURE=1` it is `Secure` and named `__Host-story_session`, so the play subdomain cannot plant one). One cookie holds grants for several stories, 24 h each. Create and import log the creator in the same way.
- **The play site** (`PlaySiteGuard`): a request with the `X-Story-Play-Site` header, which the play site's proxy always sets (`docker/Caddyfile`), reaches only `listStories`, `login`, `getPlayManifest` and `getPlayFile` (else 403): story code runs there. Every response carries `Cross-Origin-Resource-Policy: same-origin` and `X-Content-Type-Options: nosniff`, so the play site cannot embed the main site's API either. In dev the SinglePlayer's Vite proxy sets the header; the dev ports share one host's cookies, so dev is not isolated.
- **Sessions in MySQL**: `session` stores only the SHA-256 of the token, `session_grant` one row per (session, story) with `expiresAt` (cascades on story delete). A restart keeps everyone logged in. Expired grants never count; they are pruned every 10 min.
- **Login limiter** (in memory): 10 wrong passwords per client and story within 10 min → 429. With `TRUST_PROXY=1` the client is the last `X-Forwarded-For` hop.
- An `/events` stream ends when its grant expires; a public read without a grant has no expiry.

### Password reset

A story may have an `email` (optional, trimmed, `STORY_EMAIL_PATTERN`, ≤ 255 characters; `''` clears it on update). Only the editors see it: `getStoryInfo` answers a public story without a grant with `{ access: 'public', id, name, author, description }`, and with a grant the full info (`access: 'edit'`, `email`). `listStories` never carries it.

1. `POST /api/stories/:storyId/password-reset {"email"}` (`PasswordResetController`): rate-limited per client and story, 5 requests per 15 min, each one counts (a second `LoginLimiter`, token `RESET_REQUEST_LIMITER`) → 429. The email must match the story's, trimmed and case-insensitively; otherwise, and when the story has none, the server waits 1 s and answers 400 `This is not the story's email`. On a match it stores the SHA-256 of a fresh token in `story_password_reset` (one row per story, so only the newest link works; expires in 12 h, pruned with the sessions) and mails `${PUBLIC_URL}/?story=<id>&resetToken=<token>` → 204. A failed send is 500.
2. `PUT /api/stories/:storyId/password-reset {"token","password"}`: an unknown, replaced or expired token is 400 `The link is invalid or has expired`. Otherwise, in one transaction: the new password (the story `version` bumps), the reset row deleted, **every grant for the story revoked**; then the browser gets a grant and the cookie like `login` → 204.

Mail goes through `nodemailer` with `SMTP_URL` and the sender `MAIL_FROM`; without `SMTP_URL` (dev) the server logs the whole mail, link included, instead.

```bash
curl -H 'content-type: application/json' -d '{"email":"me@example.com"}' localhost:8154/api/stories/my-story/password-reset
curl -c jar -X PUT -H 'content-type: application/json' -d '{"token":"<from the log>","password":"new-secret"}' \
  localhost:8154/api/stories/my-story/password-reset
```

By hand (the example's password is `example`):

```bash
curl -c jar -H 'content-type: application/json' -d '{"password":"example"}' localhost:8154/api/stories/example/login
curl -b jar localhost:8154/api/session
```

## Stories

A story is a folder `STORIES_ROOT/<id>/` (`tsconfig.json`, `data/`, `types/`) plus a `story` row (name, author, scrypt hash, map size, description, public, email, `version`). `GET /api/stories` lists them (no password; `unlocked` = your cookie holds its grant).

```bash
# create from server/template/ (201, logs you in; the id is a slug of the name)
curl -c jar -H 'content-type: application/json' localhost:8154/api/stories \
  -d '{"name":"My Story","author":"Me","password":"secret-1","description":"","mapSize":{"width":40,"height":30},"public":false}'
curl -b jar localhost:8154/api/stories/my-story/info             # info without the password, + version
curl -b jar -X PUT -H 'content-type: application/json' localhost:8154/api/stories/my-story/info \
  -d '{"version":"<version>","name":"Renamed","password":"new-secret"}'   # mapSize is read-only
curl -b jar -o my-story.zip localhost:8154/api/stories/my-story/export
curl -b jar -F zip=@more-files.zip localhost:8154/api/stories/my-story/files   # adds / replaces files
curl -c jar -F zip=@my-story.zip -F name='My Copy' -F author=Me -F password=secret-2 -F description= -F public=false \
  localhost:8154/api/stories/import                                # 201, logs you in; the id is a slug of the name
```

- Limits (`STORY_LIMITS`, `protocol/src/dto/story.ts`): non-empty name, password ≥ 6 characters, each map side 1–500 tiles.
- Setting a story's email to a new non-empty value also sets the author email of its git settings (when connected), bumping their version; git setup defaults the author email to the story's email.
- The info `version` is the row's counter (`"1"`, `"2"`, …); a stale one is 409 `stale`.
- Create and import build the folder in a `.create-*` / `.import-*` temp dir, insert the row in a transaction, rename the folder, then commit; a failure leaves neither folder nor row. The server writes the story's `tsconfig.json` (engine paths are relative).
- **Export** holds only `tsconfig.json`, `data/` and `types/` (no metadata), plus a default `data/locations/map.json` when the story has none, so every export can be imported.
- **Export for web** (`/export/web`, same access) is the standalone player's `index.html` and `player/` (the folder `SINGLE_PLAYER_STANDALONE_DIR`; `503 unavailable` until it is built), the play manifest as `play.json`, and the story export: [`SinglePlayerStandalone.md`](SinglePlayerStandalone.md).
- **Import** is `multipart/form-data`: the `zip` file plus the New-story fields minus the map size, which comes from the zip's `data/locations/map.json`. A `story.json` in an older zip is skipped unread. Refused (400): zip-slip paths, symlinks, encrypted or duplicate entries, unknown root entries, no valid map, > 50 MB zipped or > 200 MB unpacked.
- **Add files** (`POST /api/stories/<id>/files`, write access, the landing page's per-story **Import**) is `multipart/form-data` with only the `zip`, checked like an import zip but `map.json` is optional. Its files are written into the story, replacing those of the same path; nothing is deleted, and the zip's `tsconfig.json` is ignored. Like a git pull it then reloads the story, takes the map size from `map.json`, and sends a `story` event (`reason: 'files'`).
- Loading a story rewrites a stale `tsconfig.json` and, on the first request (`sp.onFirstRun`), migrates an older story (`project/migrations/migrateStory.ts`). The steps run in this order, each in its own session with one `structure` event; each is idempotent, and a result that does not type-check is logged (`[server] … migration: <story> not migrated: …` with the diagnostics) and not written:
    - `structureLayout.ts`: a story written before the Structure tab gets `types/literals.ts`, `types/TNpc.ts` and an exported `TItemInfo`.
    - `classLayout.ts`: the built-in entity types become declaration-only classes (`export type TCharacter<Ch …> = { … }` in `types/TCharacter.ts` → `export class Character<Ch …> { declare …; }` in `types/Character.ts`; likewise `TNpc` → `Npc`, `TLocation` → `Location`). The other exports of those files move along (`TCharacterData`, `TNpcData`, `TLocationId`), every reference and module specifier in the story's own files is renamed (never in the engine packages), imports of the classes become `import type`, and the `types/index.ts` barrel follows. A step is skipped, with a log line, when the target file exists already or the alias is not an exported object type of plain properties. Items, `TChapter`, the data types and every other type stay types (see [`Visualizer.md`](Visualizer.md#story-file-conventions-the-server-relies-on) for classes and types).
    - `passageStructure.ts`: a `types/TPassage.ts` that still declares the passage structure itself is replaced by the template's binding to the `@story/shared` generics.
- **Structure** (`project/readers/structure.ts`, `writers/structure.ts`, `writers/literals.ts`): a **class** is a declaration-only `export class Race { declare …; }` in `types/Race.ts` whose instances are plain object literals (`satisfies Record<string, Race>`, id type `TRaceId`); a **type** is a `T`-prefixed `export type TData = { … }` without instances, held by other structures as a fixed-shape `struct` value. A type or literal created with `owner` is written non-exported into that class's file (no barrel line) and is usable only there: any other use is `422`. Recursive types and id cycles (also through `struct` fields) are `422`; updating a type migrates its nested `struct` values; deleting a class deletes its private members. Full rules: [`Visualizer.md`](Visualizer.md#story-file-conventions-the-server-relies-on).
- **Story code** is `.ts` and `.tsx` (`isStoryCodeFile`, `stories/storyFiles.ts`): the ts-morph project, the source editor, the play manifest and `getPlayFile` (both served as text) and so the web export all take both. Prettier formats a file by its extension, so `<` in a `.tsx` file is JSX. Only the Topbar is meant to be `.tsx`; see the next section.

### Engine settings (`data/engine/`)

```
data/engine/
    index.ts        export const engine: TEngineSettings = { onLinkClick, Topbar: () => import('./Topbar') };
    onLinkClick.ts  /** description */ export const onLinkClick: TOnLinkClick = (click, s, e) => { … };
    Topbar.tsx      /** description */ export const Topbar = ({ s, e }: TTopbarProps) => <>…</>;
```

`data/index.ts` re-exports `engine` and the types live in `types/TEngine.ts`. Both settings are optional: without `onLinkClick` no hook runs, without `Topbar` the player shows `DefaultTopbar`. The Topbar is imported lazily, so the MultiEngine (plain node) never loads React or TSX.

`GET /engine/:section` and `PUT /engine/:section` (`:section` is `onLinkClick | topbar`; `editor/engine/`, `project/readers/engine.ts`, `project/writers/engine.ts`) read and write one setting. The JSDoc of the primary export is the setting's `description`, and `code` is the file without it, so a client can send either one alone. A description without code writes a stub (a no-op `onLinkClick`, `Topbar = DefaultTopbar`), read back as `implemented: false`. The write checks the version (409), parses the code (422 with line and column), checks that the primary export is still there (422), sets the JSDoc and commits in one session with one `engine` event; the commit's type check answers new type errors with 422. Creating a setting also creates `data/engine/index.ts` and its entry; for a story made before engine settings it adds the `export * from './engine'` line to `data/index.ts`, and `types/TEngine.ts` (copied from `server/template/types/`) with its line in `types/index.ts`. Delete removes the file and its entry. DTOs and the client side: [`Visualizer.md`](Visualizer.md#api).

### `stories:import-files` and the seed

```bash
yarn workspace @story/server stories:import-files [--seed <dir>]…
```

Uses `STORIES_ROOT` and `DB_*`, runs pending migrations, then for every story folder: a legacy `story.json` is validated, upserted as the row, its tsconfig migrated, and the file deleted (an invalid one is reported and kept). Idempotent. `--seed <dir>` can be given several times (metadata from `server/seed/<basename>.story.json`): a folder without a row gets the seed row; a missing folder is copied from `<dir>` only when the database held no story before seeding (decided once, so every seed of a fresh install is copied). Dev runs it on every `yarn dev:server` start with `stories/example`; prod runs it in the entrypoint with the same, copied into the image as `/app/.seed/`.

## Git

A story's folder can be its own git repository: whoever can edit the story connects it to a remote once (URL, branch, optional access token, commit identity), and the Visualizer's Git button then offers Commit & push, Force push, Pull, Discard and the branch list (switch, create, delete). Code: `server/src/git/`, DTOs and limits in `protocol/src/dto/git.ts`, routes in [`Visualizer.md`](Visualizer.md#api).

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
- **Force push** (`gitForcePush`): `push -u --force origin HEAD`, overwriting the remote branch (400 when detached).
- **Switch branch** (`gitCheckout { branch, create }`): `create: true` makes a new branch from HEAD and keeps the uncommitted changes (409 `exists` when the name is taken); else, with a clean tree only (409 `git_dirty`), a local branch, or a remote one (a local tracking branch is created); else 404.
- **Discard** (`gitDiscard`): `reset --hard HEAD` and `clean -f -d`, so untracked files go too but ignored ones stay; then the reload below. A clean tree is left alone.
- **Branches** (`getGitBranches`): `for-each-ref` over `refs/heads` and `refs/remotes/origin` (as of the last fetch), one entry per name with `local` / `remote` / `current` and the tip commit (the local one when both exist), newest first. **Delete** (`deleteGitBranch { branch, remote }`): `branch -D`, and with `remote` also `push origin --delete`; 400 for the current branch, 404 when there is nothing to delete.
- Every status carries `head`, the current commit (`null` before the first one).
- **Settings** (`updateGitConfig`, versioned: a stale `version` is 409 `stale` with the current `TGitDto`): a new `remoteUrl` also rewrites `origin`. **Disconnect** (`deleteGitConfig { version, removeRepo }`, 204) deletes the row, and with `removeRepo` the story's `.git`.

### Reload after pull and checkout

A pull, a branch switch or a setup pull rewrites the story's files in bulk, `tsconfig.json` and the map size possibly included:

- git runs inside `bus.transaction(…)` (`events/rewriteInBulk.ts`), then `bus.settle()`. The rewritten files are marked with their current contents, so the watcher's reports are dropped and the editor gets no per-file change events, only the story event below;
- `StoryContexts.reload(storyId)` keeps the same context and bus (an open event stream holds its lease for as long as it is connected), swaps in a refresh that new requests wait for, reruns the tsconfig migration, re-arms the story migrations and replaces the watcher (a setup pull renames the folder). It never waits on leases, the caller's included. Creating a new branch changes no files and skips the reload and the event;
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

## AI agent

A story with the `aiFeature` flag gets a Claude Code agent that edits its files from the Visualizer's sidebar ([`Visualizer.md`](Visualizer.md#ai-agent)). The agent runs as `claude -p` with stream-json I/O in a hardened `story-ai` container, one per story, that sees only the story's `data/` and `types/`. Code: `server/src/ai/` (the Nest module), `server/aiLauncher/` (the sidecar that starts containers), `server/ai/agent/` (the agent's config), `docker/Dockerfile.ai`. DTOs and limits are in `protocol/src/dto/ai.ts`. The plan, its deviations and what is still open are in `plans/ai-implementation.md` (section 9). The same module generates story art with Gemini ([Image generation](#image-generation), plan `plans/ai-image-generation.md`).

```
browser ──SSE /ai/events, POST /ai/*──▶ server (AiModule) ──HTTP Upgrade, NDJSON, Bearer──▶ ai-launcher ──docker run -i──▶ story-ai-<id>-<hex>
                                         no socket, no docker CLI         network ai-control (internal)    /var/run/docker.sock        network story-ai
```

### Server module (`server/src/ai/`)

```
AiModule.ts           imports DatabaseModule + StoriesModule; registered in AppModule
aiOptions.ts          AI_OPTIONS from the env (table in Environment)
aiMessageLimiter.ts   AI_MESSAGE_LIMITER: a LoginLimiter of AI_MESSAGES_PER_MINUTE per story and minute
AiAvailability.ts     launcher /health at boot, then every 30 s while unavailable; logs each new reason
AiController.ts       the seven protocol routes, all `write` access
AiService.ts          feature / availability / credit checks, rate limit, commands, session list, transcript replay
AiAgents.ts           registry storyId → AiAgent: viewer count, idle stop, StoryLifecycle hooks, charging, boot cleanup, shutdown
AiAgent.ts            one story's agent: the stream, status, in-memory transcript, touched files, turn guard and timer, interrupt
streamJson.ts         stream-json line → TAiMessageDto / init / result; transcript `.jsonl` → messages (replay)
usage.ts              result → tokens, micro-USD, credits
aiCommands.ts         /clear, /resume [n], /cost, /help
aiEventStream.ts      the SSE writer (events/sse.ts; ends at grant expiry like /events)
agentConnection/      TAgentConnection: LauncherConnection (AI_SANDBOX=launcher), LocalConnection (AI_SANDBOX=none); imageErrors.ts
imageGen/             ImageGenService (generateImage), imagePrompt.ts (pure), mentionTargets.ts (reads the story), imageBytes.ts (sharp),
                      ImageJobs (busy), aiImageLimiter.ts (AI_IMAGE_LIMITER)
```

Routes (`/api/stories/:storyId` + path; the bodies are in [`Visualizer.md`](Visualizer.md#api)):

| Name             | Method / path        | Answer                                                                                          |
| ---------------- | -------------------- | ----------------------------------------------------------------------------------------------- |
| `getAi`          | `GET /ai`            | `TAiDto { available, imageGeneration, enabled, credits, status, sessionId }`; never an AI error |
| `aiEvents`       | `GET /ai/events`     | SSE, event name `ai`: a `snapshot`, then `status`, `message`, `activity`, `usage` and `credits` |
| `sendAiMessage`  | `POST /ai/messages`  | `{ text }` (1–20 000 characters, trimmed) → `{ ok: true }`; the reply comes on the stream       |
| `interruptAi`    | `POST /ai/interrupt` | stops the running turn, the process stays                                                       |
| `listAiSessions` | `GET /ai/sessions`   | `TAiSessionDto[]`, ≤ 10, most recently used first                                               |
| `resumeAi`       | `POST /ai/resume`    | `{ sessionId }` (a UUID of this story, else 400 / 404): restart on that session                 |
| `clearAi`        | `POST /ai/clear`     | restart on a fresh session                                                                      |

Every route but `getAi` and `aiEvents` checks, in this order: the body; `aiFeature` (403 `ai_disabled`); availability (503 `ai_unavailable`); a balance > 0 (402 `ai_no_credits`; `interruptAi` and `listAiSessions` check only the feature). `sendAiMessage` then counts the message against **`AI_MESSAGES_PER_MINUTE`** (default 20) per story: one more within the minute is 429 `too_many_requests`. Commands count too, rejected bodies do not. It is the in-memory `LoginLimiter` (the password reset's pattern, token `AI_MESSAGE_LIMITER`), so a restart resets it. A message or a restart while a turn runs is 409 `ai_busy`; a process that cannot start is 503 `ai_unavailable` ("The agent could not start").

| Status | `error`             | When                                                                       |
| ------ | ------------------- | -------------------------------------------------------------------------- |
| 402    | `ai_no_credits`     | the story's balance is ≤ 0                                                 |
| 403    | `ai_disabled`       | the story's `aiFeature` is off                                             |
| 409    | `ai_busy`           | a message, `/clear` or `/resume <n>` while a turn runs                     |
| 429    | `too_many_requests` | more than `AI_MESSAGES_PER_MINUTE` messages of the story within one minute |
| 503    | `ai_unavailable`    | no launcher, image or token (see `getAi`), or the agent failed to start    |

**Availability** (`AiAvailability`, logged as `[Ai]`): the launcher's `/health` must report a docker version, the image and a token; with `COOKIE_SECURE=1` the token must be an API key (`sk-ant-api…`), since a subscription token (`sk-ant-oat…`) may not serve other users. Image generation is a separate flag (`imageGeneration`, below), so either works without the other. The check repeats every 30 s while either is unavailable; once both are available it is not re-checked: a launcher that dies later shows up as a start failure (`status: error`). `/api/health` does not report AI.

**`aiFeature`** is a column of `story` (migration `AddAi`) that the owners cannot change: `getStoryInfo` returns it to editors, `updateStoryInfo` accepts it in the body and ignores it. Set it with the script below.

### Lifecycle

- **Start**: opening `GET /ai/events` attaches a viewer. The first viewer of a story starts its agent when the feature, availability and credits all hold. A disabled or unavailable story gets a `snapshot` and a `status` with the reason, and nothing is started. A story without credits attaches (it sees the transcript), but no process starts. Before the spawn the server computes the budget (below) and creates `<AI_SESSIONS_DIR>/<storyId>`, so the volume subpath exists. A new process starts on a fresh session: the server never resumes on its own, `/resume` does.
- **One agent per story.** Later viewers, other tabs included, attach to it and get a `snapshot` (status, credits, session, the in-memory transcript, the files touched in the running turn).
- **A turn**: `send` adds the `user` message, sets `busy`, writes `{"type":"user",…}` to stdin and arms the `AI_MAX_TURN_MS` timer (5 min), which interrupts the turn with a `system` message. `assistant` text and `tool_use` blocks become messages (`Read`/`Glob`/`Grep` are summarised, `Edit`/`Write` paths are made story-relative and reported in `activity` events); `result` charges the turn, sends `usage` and sets `ready`. `system/init` gives the session id: the session row is upserted (title = the first prompt, ≤ 120 characters) with the launcher's `pid` and `containerName`.
- **Interrupt** (`interruptAi`, the turn timer): a stream-json `control_request` `interrupt` first; if the turn has not ended 3 s later, a `{"type":"launcher_control","action":"interrupt"}` line, and the launcher sends SIGINT to the `docker run` client. Which one the CLI honours is for the spike to confirm.
- **Stop**: when the last viewer leaves, `AI_IDLE_STOP_MS` (30 s, which covers a page reload) later the server closes the stream, and the launcher stops the container. The SSE stream ends at grant expiry, so logging out stops the agent too. On exit the `pid` / `containerName` columns are cleared, the turn ends, and viewers get `status: stopped` with the reason (or the exit code and the last 600 characters of stderr). The next message starts a new process that resumes the same session (`--resume`), so the conversation goes on.
- **Folder swap**: `StoryFolders.replace()` (git setup with `initial: "pull"`) awaits `StoryLifecycle.beforeFolderSwap(storyId)` before it renames the folder, because a running container keeps its mounts on the old folder, which is then removed. `AiAgents` stops the agent (a running turn is cut off) with `status: stopped` "The story folder was replaced"; the next message starts it on the new folder and resumes the session. In-place bulk rewrites (pull, branch switch, discard, `addStoryFiles`) keep the mounts valid and leave the agent alone. `StoryLifecycle` lives in `StoriesModule`, so the AI module hooks it without a module cycle.
- **Story delete**: `AiAgents` registers on `StoryLifecycle.beforeDelete` (stop the agent with "The story was deleted", forget it, delete `<AI_SESSIONS_DIR>/<storyId>`; the DB rows cascade), but **nothing calls `beforeDelete` yet**: the server has no story delete route. Whoever adds one must await it before removing the folder.
- **Server shutdown** (`OnApplicationShutdown`) stops every agent. **Boot** (`OnApplicationBootstrap`): `DELETE /agents` on the launcher removes every container of this launcher instance, and every session row's `pid` / `containerName` is cleared. A failure there is logged, not fatal.
- The agent's edits reach the editor through the story's chokidar watcher (`data/` and `types/`, exactly what the agent can write), so there is no reload after a turn. Nothing is locked: the user may keep editing, Claude Code's `Edit` refuses a file changed since it read it, and the remaining risk (a form with unsaved input overwriting a file the agent just wrote) is shown in the sidebar's activity bar.

### Commands

`sendAiMessage` handles these itself (`aiCommands.ts`), because `claude -p` has no interactive commands. Any other `/x` goes to the CLI as a prompt (the skills' own commands).

| Input         | Effect                                                                                                               |
| ------------- | -------------------------------------------------------------------------------------------------------------------- |
| `/clear`      | stop the process, forget the transcript, broadcast an empty `snapshot`, start fresh (409 while busy)                 |
| `/resume`     | a `system` message listing the ≤ 10 recent sessions, `n. title · YYYY-MM-DD HH:MM UTC`                               |
| `/resume <n>` | replay session n's transcript as a `snapshot` and restart with `--resume <sessionId>` (400 for an n not in the list) |
| `/cost`       | a `system` message: credits left and the session's input, output, cache-read and cache-write tokens                  |
| `/help`       | a `system` message listing the commands                                                                              |

A command that takes no argument answers 400 when given one.

### Credits and the budget cap

- Tables (migration `AddAi`, `ON DELETE CASCADE` from `story`): `story_ai_credit` (one row per story, a signed `balance`: the last turn may overdraw), `story_ai_usage` (one row per `result` or generated image: `kind` `turn` | `image`, session (`null` for an image), model, the four token counts, `costMicroUsd`, `credits`; `kind` and the nullable session come from migration `AddAiImageUsage`), `story_ai_session` (below). `AiCreditRepository.charge()` (a turn) and `chargeImage()` insert the usage row and lower the balance in one transaction; `topUp()` is for the script and future billing.
- **1 credit = $0.01** of the CLI's `total_cost_usd`, rounded up per turn (`usage.ts`: `ceil(round(cost × 10⁶) × 100 / 10⁶)`).
- **Budget cap**: each spawn passes `maxBudgetUsd = min(balance / 100, claude.maxBudgetUsd)` and the launcher adds `--max-budget-usd`, so one process cannot spend more than the story had when it started. It is computed only at spawn: a top-up takes effect at the next start, and a balance that drops mid-process does not lower the cap of the running one. A turn cut off by the cap is charged like any other.
- A balance ≤ 0 refuses the next message (402) and the running turn finishes. The launcher refuses `maxBudgetUsd` above `claude.maxBudgetUsd`, which it reads from the same `ai_agents.json` as the server.

### Agents config (`ai_agents.json`)

Models, the budget cap and the image generation limits live in one JSON file, `docker/secrets/ai_agents.json` (gitignored; template `docker/secrets/ai_agents.example.json`), mounted read-only into the launcher **and** the server at `AI_AGENTS_CONFIG_FILE` (`/secret/ai_agents.json`). It holds no keys. `server/aiLauncher/agentsConfig.ts` parses it (`readAgentsConfig`, zod, strict), and the server imports it from there.

- Both sections, `claude` and `gemini`, are optional, and every missing key takes its default (the values in the example). A missing or empty file means the defaults. An invalid one (bad JSON, unknown key, `defaultModel` not in `models`, `defaultImageModel` not in `imageModels`) fails the boot with the zod error.
- `claude.models`: what the launcher allows. `claude.defaultModel` (default: the first of `models`): what the server runs. `claude.maxBudgetUsd`: the cap of one agent process, on both sides.
- `gemini` (both sides; [Image generation](#image-generation)):
    - `imageModels`: per model `creditsPerImage` (default 4, rounded up) and `maxReferences` (3); the launcher accepts only these models. Default: `gemini-nano-banana-2.1` alone (the plan's `gemini-2.5-flash-image` is deprecated and shuts down on 2027-03-15).
    - `defaultImageModel` (default: the first of `imageModels`): what the server generates with, and what an image costs.
    - `timeoutMs` (120 000): the launcher aborts a Gemini call after it; the server waits 15 s longer. `maxConcurrent` (4): Gemini calls at once in the launcher. `maxPerStory` (2): generations running at once per story. `imagesPerMinute` (6): generate requests per story and minute.
- Read once at start: after a change, `docker compose restart ai-launcher server` (dev: restart `ai-launcher` and `yarn dev`).
- Deprecated, for one release: the old variables `AI_MODELS` (launcher), `AI_MODEL` (server) and `AI_MAX_BUDGET_USD` (both) still work as fallbacks and log a deprecation line when set. A key set in the file wins over them.

### Image generation

The Visualizer's **Generate** button ([`Visualizer.md`](Visualizer.md#client-clientsvisualizersrc), Images) turns an owner's `image` description into its picture. Gemini needs no Claude: no Anthropic token, no `story-ai` image, no container. The launcher calls it in-process with the Gemini key, and never reads story files; the server sends it the prompt and the reference images, read from the requesting story only.

```
ImageEditor ──POST /images/:owner/:id/generate { prompt, version }──▶ server (ImageGenService)
server ──POST /images { storyId, model, prompt, references }──▶ ai-launcher ──generateContent──▶ Gemini
launcher ──{ mimeType, data, usage }──▶ server: WebP, uploadImage, charge, credits event ──{ ...TImageDto, credits }──▶ client
```

**Route** `generateImage`, `POST /images/:owner/:id/generate` (`write`; `ImagesController` delegates to `ImageGenService`, `ImagesModule` imports `AiModule`). Body `TGenerateImageBody { version, prompt }`: `version` is the owner's current image version (`''` without one), as for an upload; `prompt` the (possibly unsaved) description, trimmed, ≤ `IMAGE_PROMPT_MAX_LENGTH` (4 000). Answer `TGenerateImageResult`, the new `TImageDto` plus `credits`, the balance after the charge. `ImageGenService` checks, in this order:

1. the body (only `version` and `prompt`) and the owner: `story` is 400;
2. `aiFeature` (403 `ai_disabled`), `imageGeneration` (503 `ai_unavailable`), a balance > 0 (402 `ai_no_credits`);
3. the rate limit, `gemini.imagesPerMinute` per story (`AI_IMAGE_LIMITER`, an in-memory `LoginLimiter`): every request that got this far counts, one more is 429 `too_many_requests`;
4. an empty prompt (400), and for `passages` only a prompt that is an image link (`imageLinkPath`, 400); on other owners `@foo …` is plain text;
5. busy (`ImageJobs`, in memory): the same owner already generating, or `gemini.maxPerStory` generations running in the story → 409 `ai_image_busy`;
6. the owner exists (404), then the mentions (below), then the launcher call.

**Mentions** (`imageGen/imagePrompt.ts`, pure; `mentionTargets.ts` reads the story): each `@<class>:<id>` (`parseMentions`, `@story/shared`) becomes the entity's name in the prompt (its id when it has no name). `character`, `npc`, `location` and `passage` also add the entity's image as a reference labelled with its name, read with `readImageFile` (`.webp` before `.png`, regular files only); one without an image adds the name only. A mentioned passage whose description is a link uses the linked file, if it is a story image (`isStoryImageFile`) inside the story. The owner itself (`@character:thomas` on Thomas's form) uses its current image, for "the same character, a new pose". `item` and `chapter` give only the name. A duplicate mention is one reference. An unknown id, more references than the model's `maxReferences` or an unreadable reference image is 422 `invalid` with `field: 'prompt'`. Each reference is downscaled with `sharp` to at most 1024 px on the longer side, WebP quality 80. The prompt sent is the rewritten text, one line per reference ("Image 1 is Thomas, a character. Keep their look."), and a style line per owner kind (a square scene illustration, portrait or place, no lettering). Every image is 1:1 (`IMAGE_ASPECT_RATIO`).

**Storing and charging**: the answer's bytes must be WebP, PNG or JPEG (else 502 `ai_image_failed`); a WebP is stored as it is, a PNG or JPEG is converted with `sharp` at quality 80 (`STORED_WEBP_QUALITY` = 0.8 in `protocol/src/dto/image.ts`, which the client's uploads use too). Then `uploadImage` with the client's `version` (409 `stale`, the `.png` sibling deleted). `AiCreditRepository.chargeImage()` inserts a `story_ai_usage` row of `kind: 'image'` (no session; Gemini's prompt and candidate tokens as input and output; `costMicroUsd` = the credits at $0.01) and lowers the balance by `creditsPerImage` of `defaultImageModel`. A failed generation is not charged; a `stale` or vanished owner after generating is, because the image was made. Then a `{ type: 'credits', credits }` event goes to the story's AI stream, so open AI sidebars show the new balance. Image writes emit no story event, as for an upload.

**Errors** (`agentConnection/imageErrors.ts`). Besides `bad_request`, `not_found`, `invalid`, `stale` and the AI codes above:

| Launcher answer                                                          | Server answer                                                |
| ------------------------------------------------------------------------ | ------------------------------------------------------------ |
| 422 `image_failed` (refused, safety block, no image part)                | 502 `ai_image_failed` with the launcher's (scrubbed) message |
| 503 `gemini_unavailable` (no key, quota, outage), 401 (wrong bearer key) | 503 `ai_unavailable` "Image generation is unavailable: …"    |
| 429 (launcher concurrency)                                               | 429 `too_many_requests`                                      |
| 504 `timeout`, or no answer within `gemini.timeoutMs` + 15 s             | 502 `ai_image_failed` "Generating took too long"             |
| anything else, or an unreadable body                                     | 502 `ai_image_failed`                                        |

**Launcher** `POST /images` (`imagesRoute.ts`, Bearer like every route): with no Gemini key 503 `gemini_unavailable`; over `gemini.maxConcurrent` calls in flight 429. The body (JSON, read capped at 8 MB, else 413) is validated by `imageRequest.ts` (strict zod, else 400): `storyId` against `STORY_ID_PATTERN` (logs only), `model` one of `gemini.imageModels`, `prompt` 1–4 000 characters, `references` at most that model's `maxReferences`, each `{ label, mimeType: 'image/webp' | 'image/png', data }` with base64 `data` of at most 1 MB and a matching signature. `gemini/generateImage.ts` makes one `models.generateContent` call (`@google/genai`, client injected): the prompt, then each reference as `inlineData`, `responseModalities: ['IMAGE']`, `aspectRatio: '1:1'`, aborted after `gemini.timeoutMs` (504 `timeout`). It answers 200 `{ mimeType, data, usage: { promptTokens, candidatesTokens, totalTokens } }` with the first non-thought image part; no image part is 422 `image_failed` with the block or finish reason and Gemini's text. A Gemini 400 is 422 `image_failed`, quota (429, `RESOURCE_EXHAUSTED`) and anything else 503 `gemini_unavailable`. `/health` adds `gemini` (a key is set) and `imageModels`; the server's `imageGeneration` is `gemini && imageModels.length > 0`, whatever the Anthropic token or the agent image.

**The key**: `AI_GEMINI_TOKEN_FILE` (default `/secret/gemini_token`), read by the launcher only, at start; missing or empty means no image generation (the launcher still starts, and serves agents). Prod compose mounts `docker/secrets/gemini_token` (gitignored; `make prod-up` creates it empty when missing) as a secret into the launcher alone; the dev launcher reads it from the repo mount. In prod the launcher also joins the `gemini-egress` network (a plain bridge with internet; `ai-control` is internal) to reach `generativelanguage.googleapis.com`. Use a **paid-tier** key, so Google doesn't train on story content (it may use free-tier prompts). With `AI_SANDBOX=none` (dev), `LocalConnection` generates in-process with the developer's `GEMINI_API_KEY` from the server's env; without it `imageGeneration` is false.

### Sessions

- `story_ai_session` keeps the **10** most recently used sessions per story (`sessionId` = Claude Code's, `title`, `createdAt`, `lastUsedAt`, and `pid` / `containerName` while running). After each upsert, `prune(storyId, 10)` deletes the older rows, and the server deletes their `<sessionId>.jsonl` (and `<sessionId>/`) transcripts.
- Transcripts live in the sessions volume (`AI_SESSIONS_VOLUME` for the launcher, mounted into the server at `AI_SESSIONS_DIR`), one subpath per story mounted at the container's `~/.claude/projects`. Claude Code names a project folder after its working directory, so a session is `<AI_SESSIONS_DIR>/<storyId>/-repo-stories-story/<sessionId>.jsonl`. `/resume <n>` and `resumeAi` replay it through `streamJson.ts` (a missing file replays as empty).
- The in-memory transcript is what viewers see. It survives process restarts but not a server restart: after one, the sidebar starts empty until `/resume`.

### The launcher (`server/aiLauncher/`)

A plain Node `http` server (no Nest), `yarn workspace @story/server launcher`. It is the only process with the docker socket and the only one that reads the Anthropic token and the Gemini key. In prod it is the `launcher` target of `Dockerfile.prod` (the `app` image plus `docker-ce-cli`, `docker/install-docker-cli.sh`); in dev, the `launcher` stage of `Dockerfile.dev` running the repo mount. It listens on `AI_LAUNCHER_PORT` (8155) on the internal `ai-control` network, which agents are not on.

- Startup: read the key file (missing or empty: exit), read and classify the token (missing or unknown: agents are refused, `/health` says `token: null`), read the Gemini key (missing or empty: images are refused, `gemini: false`), create `AI_NETWORK` if it is missing, remove orphaned containers of its instance. SIGTERM / SIGINT stop every agent.
- **Auth**: every request needs `Authorization: Bearer <key>`, compared as SHA-256 digests with `timingSafeEqual`; else 401 `{ error: "unauthorized" }`.
- **It builds the docker argv itself** (`sandbox/dockerArgs.ts`, pure and unit-tested) from its own config; the server sends only `{ storyId, resumeSessionId?, model?, maxBudgetUsd }`, never paths, flags or images. `launchRequest.ts` validates it (strict object): `storyId` against `STORY_ID_PATTERN` (again in `dockerArgs`), `resumeSessionId` a UUID, `model` one of `claude.models`, `0 < maxBudgetUsd ≤ claude.maxBudgetUsd` (and not 0 at 6 decimals). The body is at most 16 KB and must arrive within 10 s.

| Route                           | Answer                                                                                                                                                                |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /health`                   | `{ docker: <server version> \| null, image: boolean, token: "api_key" \| "oauth" \| null, driver, gemini: boolean, imageModels: string[] }`                           |
| `POST /agents`                  | needs `Upgrade: story-ai-agent` (426 without one) and a JSON body with `Content-Length`; 400 invalid, 413 too large, 503 `token_unavailable`, 500 `spawn_failed`      |
| `GET /agents`                   | `{ containerName, storyId, pid }[]`, the agents of this launcher process                                                                                              |
| `DELETE /agents/:containerName` | stop one: `{ ok: true }`, or 404                                                                                                                                      |
| `DELETE /agents`                | stop every agent and remove every container of this instance: `{ removed }`                                                                                           |
| `POST /images`                  | one Gemini image ([Image generation](#image-generation)): 200 `{ mimeType, data, usage }`, 400, 413, 422 `image_failed`, 429, 503 `gemini_unavailable`, 504 `timeout` |

**The agent stream.** After `101 Switching Protocols` the socket carries NDJSON both ways. The launcher writes `{"type":"launcher","event":"started","containerName","pid"}` first (`pid` is the `docker run` client's, `containerName` is `story-ai-<storyId>-<8 hex>`, the real handle), then the CLI's stdout lines unchanged, then `{"type":"launcher","event":"exited","code","stderrTail"}` (the last 4 KB of stderr). Lines from the server go to the CLI's stdin, except `{"type":"launcher_control","action":"interrupt"}`, which sends SIGINT to the client process. When the socket closes, the launcher stops the agent: close stdin, SIGTERM, `docker stop -t 5`, and `docker rm -f` plus SIGKILL if it has not exited after 10 s.

**Instances**: every container carries the labels `story-ai=1`, `story-ai.story-id=<id>` and `story-ai.instance=<AI_INSTANCE>`. Orphan cleanup removes only its own instance's containers, so a dev and a prod launcher on one host leave each other's agents alone.

| Variable                | Default                   | Meaning                                                                                                                                                                                                                              |
| ----------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `AI_GEMINI_TOKEN_FILE`  | `/secret/gemini_token`    | The Gemini API key (paid tier), read once at start and trimmed. Missing or empty: no image generation.                                                                                                                               |
| `AI_TOKEN_FILE`         | `/secret/ai_token`        | The Anthropic token, read once at start and trimmed. `sk-ant-api…` → `ANTHROPIC_API_KEY`, `sk-ant-oat…` → `CLAUDE_CODE_OAUTH_TOKEN`; anything else counts as none.                                                                   |
| `AI_LAUNCHER_KEY_FILE`  | `/secret/ai_launcher_key` | The shared bearer key (the server reads the same file). Required.                                                                                                                                                                    |
| `AI_LAUNCHER_PORT`      | `8155`                    |                                                                                                                                                                                                                                      |
| `AI_SANDBOX_DRIVER`     | `docker-run`              | `docker-run` \| `docker-sandbox` (below).                                                                                                                                                                                            |
| `AI_IMAGE`              | `story-ai:latest`         | The agent image (`make ai-image`).                                                                                                                                                                                                   |
| `AI_STORIES_VOLUME`     | –                         | Prod: the name of the stories volume (`story-prod_stories`). The story folders are mounted as its subpaths.                                                                                                                          |
| `AI_STORIES_HOST_DIR`   | –                         | Dev: the host path of `stories/` (bind mounts resolve on the host). Exactly one of the two must be set, else the launcher exits. Absolute, no commas.                                                                                |
| `AI_REPO_HOST_DIR`      | –                         | Dev: the host path of the repo; with `AI_STORIES_HOST_DIR`, the engine is bind-mounted read-only from it so edits show live.                                                                                                         |
| `AI_SESSIONS_VOLUME`    | `story-ai-sessions`       | The volume of the transcripts, one subpath per story.                                                                                                                                                                                |
| `AI_NETWORK`            | `story-ai`                | The agents' docker network, created at startup when missing (a plain bridge, with internet).                                                                                                                                         |
| `AI_INSTANCE`           | `prod`                    | The `story-ai.instance` label value (dev compose: `dev`).                                                                                                                                                                            |
| `AI_AGENTS_CONFIG_FILE` | `/secret/ai_agents.json`  | The agents config (above): the allowed models (`claude.models`), the largest `maxBudgetUsd` (`claude.maxBudgetUsd`) and the image models and limits (`gemini`). Replaces `AI_MODELS` and `AI_MAX_BUDGET_USD` (deprecated fallbacks). |

### Sandbox drivers

`TAiSandboxDriver` (`sandbox/`): `spawn`, `stop`, `remove`, `cleanupOrphans`, `ensureNetwork`, `health`.

- **`docker-run`** (prod default, Linux dev): `docker run --rm -i` of the `story-ai` image with the layout and flags below. Volume subpaths need Docker Engine ≥ 26.
- **`docker-sandbox`** (Docker Desktop only): `docker sandbox run --name … -e <token var> -v <host>/<id>/data:… -v <host>/<id>/types:… claude <args>`. It needs `AI_STORIES_HOST_DIR`, mounts no engine or sessions, does not use the hardening flags (the microVM is the boundary) and has no network setup. **Its flags are a guess**, not yet run: Docker Sandboxes is a Docker Desktop feature that the spike has to try.
- `AI_SANDBOX=none` on the server skips the launcher altogether (`LocalConnection`): `claude` runs unsandboxed on the server in the story folder, with the developer's own login and `~/.claude/projects`; images are generated in-process with `GEMINI_API_KEY`. Dev only; the boot refuses it with `COOKIE_SECURE=1`. Untried.

### Container layout

The agent sees a fake repo with one story whose folder is always `story`, so the story's relative engine paths resolve as on the server and the story id never appears inside:

```
/repo/tsconfig.base.json                          image (dev: bind :ro from AI_REPO_HOST_DIR)
/repo/clients/shared/{core,utils,ui}/src          image, read-only (dev: bind :ro of the package folders)
/repo/node_modules/@types/react                   image, the versions in yarn.lock
/repo/node_modules/@mui/icons-material/*.d.ts     image, declarations only
/repo/stories/story/tsconfig.json                 image: server/ai/agent/tsconfig.json (= storyTsconfig() two levels down)
/repo/stories/story/data                          ← stories volume subpath <storyId>/data   (rw)
/repo/stories/story/types                         ← stories volume subpath <storyId>/types  (rw)
/home/agent                                       tmpfs, uid 1000, 0700, 64 MB
/home/agent/.claude/projects                      symlink → /sessions (by the entrypoint)
/sessions                                         ← sessions volume subpath <storyId>       (rw)
/opt/agent/claude/                                image: server/ai/agent/{CLAUDE.md,settings.json,skills/}
/tmp                                              tmpfs
```

`WORKDIR /repo/stories/story`, user `agent` (uid 1000, the owner of the story files). `docker/ai-entrypoint.sh` copies `/opt/agent/claude/*` into the empty tmpfs `~/.claude/` and links `~/.claude/projects` to `/sessions` (mounting it inside HOME would make docker create `~/.claude` root-owned), then `exec claude "$@"`. The image pins `@anthropic-ai/claude-code` (`CLAUDE_CODE_VERSION`: bump it on purpose, the stream-json shapes the server parses come from it) and turns off auto-updates, telemetry and error reporting. `server/__tests__/ai/agentImage.test.ts` fails when the Dockerfile misses an `enginePaths()` entry, when the type-declaration versions drift from `node_modules`, or when the baked tsconfig differs from `storyTsconfig()`. The agent's role and the story conventions are in `server/ai/agent/CLAUDE.md` and the skills `story-files`, `passages`, `entities`, `structure`.

The CLI runs as `claude -p --input-format stream-json --output-format stream-json --verbose --permission-mode acceptEdits --allowedTools Read,Edit,Write,Glob,Grep,Skill --disallowedTools Bash,WebFetch,WebSearch --max-budget-usd <usd> [--resume <id>] [--model <model>]` (`claudeArgs`).

### Security model

- **The server never touches docker.** Only the launcher has the socket (a socket proxy would still allow `--privileged -v /:/host`); the server image has no docker CLI. The launcher builds every docker argument itself and accepts only validated parameters, so a compromised server can start agents for a valid story id with a capped budget, nothing more. The `ai-control` network is `internal` and joined only by the server and the launcher; the bearer key is a file secret (`openssl rand -hex 32`) shared by the two.
- **The token stays in the launcher.** It reaches the container as `-e ANTHROPIC_API_KEY` without a value, so docker copies it from the client's environment and it is never in argv or `ps`. The agent can read its own env; that is accepted because the token leaves the sandbox only towards Anthropic (an egress proxy that injects the key would remove even that). Production requires an API key.
- **Only `data/` and `types/` are mounted.** The story's `.git/`, `.gitignore`, `tsconfig.json` and other top-level files are not in the container: the server runs `git` in the story folder, and a writable `.git/config` (filter drivers, the remote URL) would mean code execution or token theft on the server. Permission rules alone are not enough, since the model can be prompt-injected. Other stories, the server and the database are not reachable as files.
- **Hardening** (`docker-run`): `--read-only` root, tmpfs `/tmp` and `/home/agent`, `--cap-drop ALL`, `--security-opt no-new-privileges`, `--pids-limit 256`, `--memory 1g`, `--cpus 1`, `--user 1000:1000`; the engine sources are read-only. Claude Code tools: only `Read, Edit, Write, Glob, Grep, Skill`, with `Bash, WebFetch, WebSearch` disallowed on the command line and denied in `settings.json`.
- **Gemini runs in the launcher, not in a container**: an image job runs no agent and no story code. The launcher never reads story files; the server resolves mentions against the requesting story only and sends the reference bytes (validated WebP / PNG, ≤ 1 MB each). The Gemini key stays in the launcher, like the Anthropic token.
- **Not yet**: the `story-ai` network has full internet egress (an allow-list proxy for `api.anthropic.com` is open), and the hardening has not been tried against a live agent (the acceptance checks in the plan).

### `ai:enable`

```bash
yarn workspace @story/server ai:enable <storyId> [--credits N]
docker compose -f docker/docker-compose.prod.yml exec server yarn ai:enable <storyId> --credits 500   # prod
```

Uses `DB_*`, runs pending migrations, turns `aiFeature` on and adds N credits (`topUp`), then prints the balance. An unknown story exits 1. There is no way to turn the feature off or to set a balance other than SQL (`UPDATE story SET aiFeature = 0 …`, `story_ai_credit`).

### Unverified until the spike

Phase 1 of the plan (a hand run of `claude -p` in the `story-ai` container) could not run where this was built, as there was no Docker. Until it does, these are assumptions:

- the **stream-json shapes**: `server/__tests__/fixtures/ai/` (`editTurn`, `budgetStop`, `session.transcript`) are hand-written from the documented format, not captured, and the transcript folder name `-repo-stories-story` is derived;
- the **interrupt**: whether the CLI honours a stream-json `control_request` `interrupt`, or only the SIGINT fallback (and whether `docker run -i` forwards it to the container);
- **`--max-budget-usd`**: that the pinned CLI has it, whether it caps the process or a turn (if a turn, the cap must be recomputed per turn by restarting with `--resume`), and how a turn stopped by it ends;
- a **tmpfs HOME**: that Claude Code runs with an empty `/home/agent` filled by the entrypoint on a read-only root, and `--resume` finds its sessions in the mounted `projects`;
- **`volume-subpath`** for `<storyId>/data` on the production engine, and that the files keep uid 1000;
- the **`docker-sandbox` driver**: its flags, mounts and stop / list commands;
- **`LocalConnection`** (`AI_SANDBOX=none`): never run against a real `claude`;
- also: the stdin/stdout path through the HTTP Upgrade under load, that `Edit` refuses stale files, and that the watcher alone keeps `SourceProject` current after agent writes (if not, call `StoryReloader.afterBulkRewrite` after each `result`).

## Environment

From `server/src/config/env.ts` (`ENV_SCHEMA`; an invalid value fails the boot with a readable message):

| Variable                       | Default                   | Meaning                                                                                                                                                                                                                                                                                                 |
| ------------------------------ | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PORT`                         | `8154`                    | Listen port (on `0.0.0.0`).                                                                                                                                                                                                                                                                             |
| `STORIES_ROOT`                 | `stories`                 | One folder per story; relative paths resolve against the repo root. SinglePlayer's dev server reads the same variable: keep them equal.                                                                                                                                                                 |
| `DB_HOST`                      | `mysql`                   | MySQL host (the compose service). Use `127.0.0.1` outside docker.                                                                                                                                                                                                                                       |
| `DB_PORT`                      | `3306`                    |                                                                                                                                                                                                                                                                                                         |
| `DB_USER`                      | `story`                   |                                                                                                                                                                                                                                                                                                         |
| `DB_PASSWORD`                  | `story`                   | Prod: from `docker/.env`.                                                                                                                                                                                                                                                                               |
| `DB_NAME`                      | `story`                   | The tests always use `story_test` (see Tests).                                                                                                                                                                                                                                                          |
| `COOKIE_SECURE`                | off                       | `1` marks the cookie `Secure` (behind HTTPS).                                                                                                                                                                                                                                                           |
| `TRUST_PROXY`                  | off                       | `1` keys the login limiter on the last `X-Forwarded-For` hop (the one the proxy wrote). Only when the server is reachable through the proxy alone.                                                                                                                                                      |
| `ALLOWED_ORIGINS`              | the dev ports             | Comma-separated origins a mutation may come from. Default: `http://localhost:<p>` and `http://127.0.0.1:<p>` for 8150, 8151, 8153, 8154.                                                                                                                                                                |
| `GIT_TOKEN_KEY`                | unset                     | 32 bytes in base64 (`openssl rand -base64 32`) that encrypt the stored git tokens. Unset: git is unavailable (see Git).                                                                                                                                                                                 |
| `GIT_ALLOWED_HOSTS`            | any                       | Comma-separated host names a git remote may point at (`github.com,gitlab.com`). Set it in prod to limit SSRF.                                                                                                                                                                                           |
| `GIT_DISABLED_STORIES`         | `example`                 | Comma-separated story ids that cannot be connected to git (the example is committed in this repo). An empty value enables every story.                                                                                                                                                                  |
| `PUBLIC_URL`                   | `http://localhost:8153`   | The landing page's origin: the base of the password reset links. Never taken from the request's headers. Prod: `https://<SITE_ADDRESS>`.                                                                                                                                                                |
| `SMTP_URL`                     | unset                     | SMTP connection URL for the password reset mails (`smtps://user:password@host:465`). Unset: the mails are only logged.                                                                                                                                                                                  |
| `MAIL_FROM`                    | required                  | The mails' sender. Set by `docker/Dockerfile.dev` and `docker/Dockerfile.prod` (hardcoded for now, see `plans/rosti-release.md`); the server tests get it from `vitest.workspace.ts`.                                                                                                                   |
| `SINGLE_PLAYER_STANDALONE_DIR` | the standalone build      | The player folder that **Export for web** zips: `clients/SinglePlayer/dist-standalone` (`build:standalone`); relative paths resolve against the repo root. No `index.html` in it: that export answers 503.                                                                                              |
| `AI_SANDBOX`                   | `launcher`                | `launcher`: agents run through the AI launcher. `none`: `claude` runs unsandboxed on the server (dev only; refused with `COOKIE_SECURE=1`).                                                                                                                                                             |
| `AI_LAUNCHER_URL`              | `http://ai-launcher:8155` | The launcher (see AI agent).                                                                                                                                                                                                                                                                            |
| `AI_LAUNCHER_KEY_FILE`         | `/secret/ai_launcher_key` | The bearer key shared with the launcher. Missing: AI is unavailable.                                                                                                                                                                                                                                    |
| `AI_SESSIONS_DIR`              | `/app/ai-sessions`        | The sessions volume as the server sees it (replay and pruning of transcripts); relative paths resolve against the repo root.                                                                                                                                                                            |
| `AI_AGENTS_CONFIG_FILE`        | `/secret/ai_agents.json`  | The agents config (see AI agent): the model every agent runs (`claude.defaultModel`), the most one agent process may spend (`claude.maxBudgetUsd`, `--max-budget-usd` is the smaller of this and the balance) and the image limits. Replaces `AI_MODEL` and `AI_MAX_BUDGET_USD` (deprecated fallbacks). |
| `AI_IDLE_STOP_MS`              | `30000`                   | How long an agent outlives its last viewer.                                                                                                                                                                                                                                                             |
| `AI_MAX_TURN_MS`               | `300000`                  | A turn is interrupted after this long.                                                                                                                                                                                                                                                                  |
| `AI_MESSAGES_PER_MINUTE`       | `20`                      | `sendAiMessage` calls per story and minute; more answer 429.                                                                                                                                                                                                                                            |
| `GEMINI_API_KEY`               | unset                     | Dev only, with `AI_SANDBOX=none`: the Gemini key `LocalConnection` generates images with. With the launcher the key is its `AI_GEMINI_TOKEN_FILE` instead.                                                                                                                                              |

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
- `__tests__/helpers/testApp.ts#createTestApp({ stories, watch, … })` boots the real `AppModule` on a temp `STORIES_ROOT` (copies of the example, rows seeded with password `example`), truncated tables, listening on a random port; it returns `{ base, project(id), story(id), stories, sessions, contexts, mailer, wrongEmailDelays, close }`. Mails go to a `FakeMailer` (`mailer.sent`), and the password reset's 1 s wrong-email delay is only counted. Never boot a test app on the real `stories/`. `overrideModules` swaps a feature module for a probe. `helpers/http.ts` has `requestJson`, `login`, `waitFor`.
- Migration suites (`structureLayout`, `classLayout`, `passageStructure`) start from the example rewritten to an older layout: `__tests__/fixtures/pre*/` holds those story files as `.txt` (so tsc and the linters skip them), written by `helpers/fixtures.ts` (`writeFixture`, `toPreClassLayout`).
- Don't run a dev server against `story_test` while the tests run.
- AI is unavailable in a test app unless `createTestApp({ agentConnection })` brings a healthy connection: `helpers/FakeAgentConnection.ts` records launches and lets a test emit stream-json lines (`initLine`, `resultLine`); `createTestApp({ ai })` overrides `TAiOptions`. Its `generateImage` records `imageCalls` and answers `respondImage` (a real PNG from `helpers/images.ts` by default). The launcher's tests (`__tests__/aiLauncher/`) run its http server against a fake driver and a fake Gemini client (`fakeGemini.ts`), and never call docker or Google.
- Git is unavailable in a test app unless `createTestApp({ git })` overrides the git options; `helpers/git.ts` has `TEST_GIT_OPTIONS` (a test key, `allowFileRemotes`) and temp bare repos as `file://` remotes. `allowFileRemotes` (env `GIT_ALLOW_FILE_REMOTES=1`) is test-only: `gitRemote` then accepts `file://` and `GitRunner` adds `-c protocol.file.allow=always`. Never set it in prod.

## Adding a route

1. **Protocol** (`protocol/src/routes.ts`): add the entry to `STORY_ROUTES` (path relative to `/api/stories/:storyId`) or `GLOBAL_ROUTES` with `method`, `path` and `access`, its body and response in `TApiSpec`, DTOs in `protocol/src/dto/`. `CREATED_ROUTES` / `NO_CONTENT_ROUTES` for 201 / 204.
2. **Handler**: a method with `@ProtocolRoute('<name>')` in the feature's controller (`server/src/editor/<feature>/`; a new feature gets `<Feature>Module` + `<Feature>Controller`, imported in `AppModule`). Path, method and status come from the protocol. Take `@StoryCtx()`, `@RouteParams() params: THandlerParams<'<name>'>` (validated `kind`/`owner`), `@Body() body: TRouteBody<'<name>'>`, return `Promise<TRouteResponse<'<name>'>>`; put the logic in `project/` readers/writers.
3. **Boot check**: `ProtocolRouteCheck` fails startup (and every test app) when a protocol route has no handler, two handlers, or a handler names an unknown route. Access, CSRF, body, lease and errors need no per-route code.
4. Clients: `clients/Visualizer/src/api/types.ts`, `httpApi.ts` **and** `mockApi.ts`; the API table in [`Visualizer.md`](Visualizer.md#api).

## Production

`docker/docker-compose.prod.yml` runs the server from `/app/server` with the same loader, `COOKIE_SECURE=1`, `ALLOWED_ORIGINS=https://<SITE_ADDRESS>`, `TRUST_PROXY=1`, `PUBLIC_URL=https://<SITE_ADDRESS>`, the `DB_*` secrets and `GIT_TOKEN_KEY` (plus the optional `GIT_ALLOWED_HOSTS` and `SMTP_URL`) from `docker/.env` and `STORY_DB_SETUP=1`: the entrypoint applies the migrations, imports legacy `story.json` files of the `stories` volume and seeds the example and the demo. MySQL (`mysql:8.4`, volume `mysql`) is reachable only by the server; back up both volumes, and keep `GIT_TOKEN_KEY` with the database backup (without it the stored git tokens must be re-entered). Without `GIT_TOKEN_KEY` the server runs with git unavailable. The server also joins the internal `ai-control` network and mounts the `story-ai-sessions` volume for the AI agent; the `ai-launcher` service and its secrets (`gemini_token` for the launcher only, `ai_agents.json` for both) are described in the compose file's header and in AI agent above. How to deploy: [`README.md`](README.md#production).
