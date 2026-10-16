# Code review: branch `structures`

Run with `/code-review branch structures` on 2026-10-15. The findings below have not been checked against the code yet.

## Likely bugs

### 1. Older exports without `map.json` fail to import

`server/src/stories/storyInput.ts:81`

Import now takes the map size only from `data/locations/map.json` and throws away the zip's `story.json`. A zip exported before this branch, from a story with no `map.json`, cannot be imported.

- **Failure scenario:** The committed example story has no `data/locations/map.json`, and the old server exported folder contents as-is. Exporting the example (or any story whose map was never saved) on the old server gives a zip with `story.json` (holding `mapSize`) but no `map.json`. Importing that zip on the new server fails with 400 "The zip has no data/locations/map.json". `entryPath` drops the legacy `story.json`'s `mapSize`, and nothing uses it as a fallback.
- **Suggested fix:** Fall back to `mapSize` from the zip's `story.json` when `map.json` is missing.

### 2. Health check returns 500 instead of 503

`server/src/common/ApiExceptionFilter.ts:14`

`HTTP_EXCEPTION_CODES` has no entry for 503. `HealthService`'s `ServiceUnavailableException` therefore becomes `internal` and is sent as 500, not the 503 that `THealthDto` documents.

- **Failure scenario:** When MySQL is down, `GET /api/health` throws `ServiceUnavailableException` (503). The filter maps that status to error `internal`, and `ERROR_STATUS.internal` is 500, so the client gets 500. The protocol says "otherwise the response is 503". Any monitor that treats 503 (unavailable) differently from 500 (bug) is misled.

### 3. Server starts even when `STORIES_ROOT` is not a directory

`server/src/stories/storiesRoot.ts:7`

The old `createApp` refused to start when `STORIES_ROOT` was not a directory. The Nest server dropped that check and nothing replaces it.

- **Failure scenario:** With `STORIES_ROOT` set to a mistyped path, the server boots normally and lists every story from the DB. Opening a story loads a `ProjectRoot` on a missing folder, so every request for it fails. `createStory` silently creates the wrong root with `mkdir` and puts new stories there. The old server stopped at startup instead.

### 4. HEAD requests to public story routes get 401

`server/src/auth/UnmatchedStoryPathMiddleware.ts:12`

`matchRoute` compares the HTTP method exactly. A HEAD to a real story GET route therefore counts as "unmatched" and needs a session grant, even on a public story.

- **Failure scenario:** `HEAD /api/stories/<public-story>/images/x/y/png` without a cookie: no `STORY_ROUTES` entry has method HEAD, so `unmatchedStoryId` returns the story id and the middleware throws 401 "Story is locked". The same URL answers 200 to GET because `StoryAccessGuard` allows public reads. Preflight checks and link checkers get inconsistent results.

## Performance and wasted work

### 5. `Session.lastSeenAt` is written but never read

`server/src/auth/SessionService.ts:50`

Nothing reads `Session.lastSeenAt` for expiry, pruning or anything else, yet `expiresAt()` runs an UPDATE for it on the guarded request path.

- **Failure scenario:** Every story request goes through `StoryAccessGuard`, which calls `sessions.expiresAt()`. That adds a DB write at most once every 5 minutes per session, plus one in every `grant()`, for a column nothing uses.
- **Suggested fix:** Drop the column and the write, or use it (for example, idle expiry in `prune`).

### 6. Migrations run three times on every production start

`docker/prod-entrypoint.sh:15`

The entrypoint runs `yarn migration:run`, then `importStoryFiles.ts` calls `dataSource.runMigrations()` again, then `DatabaseModule` boots with `migrationsRun: true`.

- **Failure scenario:** Each server container start opens three separate DB connections that run the migration check, which slows startup for nothing.
- **Suggested fix:** Keep one of the three (for example, only the import script, or only `migrationsRun`).

### 7. Password hashing holds a pooled DB connection

`server/src/stories/StoryInfoController.ts:41`

`applyUpdateStoryBody` hashes the new password with scrypt (N=16384) inside the `stories.exclusive` DB transaction, so a pooled MySQL connection stays held for the whole hash.

- **Failure scenario:** Several concurrent `updateStoryInfo` requests that change the password each keep a transaction and connection open for the scrypt time (tens of ms or more). That can exhaust the TypeORM pool and stall other requests that need the DB, such as the access guards.
- **Suggested fix:** Hash before the transaction starts and only write inside it.

## Style and duplication

### 8. Duplicated `errorMessage` and `exists` helpers

`server/src/stories/importStoryFiles.ts:22`

The file re-implements `errorMessage`, which `common/HttpError.ts` already exports. It also has an `exists` helper copied byte-for-byte in `StoryFolders.ts:31`, and `zip.ts` uses the same lstat-and-catch pattern.

- **Problem:** The same logic now lives in 3 or more places. That breaks the CLAUDE.md rules "extract a shared utility once logic repeats 3+ times" and "search the codebase first to avoid duplication".
- **Suggested fix:** Import `errorMessage` from `../common/HttpError` and move `exists()` into a shared fs helper.

### 9. Body validation repeated after the interceptor

`server/src/auth/AuthController.ts:31`

`JsonBodyInterceptor` already sets `req.body` to `jsonObjectBody(...)` for every JSON route, so calling `jsonObjectBody(body)` again in `login`, `createStory` and `updateStoryInfo` does nothing.

- **Problem:** The validation is repeated in four places, and the repeated calls suggest the body might not have been checked yet.
- **Suggested fix:** Have the interceptor provide a typed `Record<string, unknown>`, or have the controllers rely on it, instead of checking again in every handler.

### 10. JSDoc comment in app code

`clients/LandingPage/src/storyForm.ts:9`

A JSDoc comment was added in app code: ``/** `import` takes the map size from the zip. */``.

- **Problem:** The CLAUDE.md Comments section says: "No JSDoc — types are the documentation; exception: the public API of shared internal packages". LandingPage is an app, not a shared internal package.
