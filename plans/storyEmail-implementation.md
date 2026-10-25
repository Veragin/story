# Story email + forgotten password — implementation plan

## Goal

- New optional `email` on a story, kept in the DB and edited in the story form on the landing page (create + edit).
  Hint under the field: _"Used as the author email of git commits and to reset a forgotten password."_
- Setting the email also sets the author email in the story's git config, so commits use it.
- Story settings move from the landing page to a whole page in the Visualizer; creating a story also becomes a whole page; the git section on both is collapsible.
- In the password prompt, a **Forgotten password** link sits under the password input. The user enters the story's
  email. If it matches, the server mails a link carrying a fresh token that expires in 12 hours. The link opens a page
  that sets a new password for the story.

## Decisions (confirmed)

| #   | Decision                                                                                                                                                                                                                                                                                                                                                          |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | The email must match (trimmed, case-insensitive). On a mismatch the server waits **1 s**, then answers `400 bad_request`: _"This is not the story's email"_. A story without an email gets the same error. On a match it answers `204`.                                                                                                                          |
| D2  | The reset request is rate-limited per IP and story. It reuses the `LoginLimiter` class as a second instance (`RESET_REQUEST_LIMITER` token) with 5 requests per 15 minutes, and every request counts (`429`). This stops inbox spam and brute-forcing the email; the 1 s delay alone does not stop parallel requests.                                                 |
| D3  | Tokens live in a new table `story_password_reset`, one row per story (`storyId` PK). Only the sha256 of the token is stored (`hashToken` from `SessionService`). A new request replaces the old row, so only the newest link works.                                                                                                                               |
| D4  | A successful reset sets the password (bumping the story `version`), deletes the reset row, **revokes every grant for the story** and gives the resetting browser a grant. The reset page says so up front: _"Everyone logged in to this story will be logged out; you will be logged in with the new password."_                                                 |
| D5  | No override at commit time. Saving a story whose email **changed to a non-empty value** also writes `story_git.authorEmail` (when the story is connected to git). `setupGit` defaults `authorEmail` to the story email, falling back to `<storyId>@story.local`. The Visualizer's git author email field stays editable; the next story-email change overwrites it. |
| D6  | `getStoryInfo` without a grant (a public story) answers only `{ access: 'public', id, name, author, description }`. With a grant it answers the full info, including `email`, as `access: 'edit'`. `listStories` is unchanged; it never carries the email.                                                                                                       |
| D7  | The link points at the landing page: `${PUBLIC_URL}/?story=<id>&resetToken=<token>`. `PUBLIC_URL` is a new env var (dev default `http://localhost:8103`, prod `https://${SITE_ADDRESS}`). It is never derived from the `Host`/`Origin` headers.                                                                                                                  |
| D8  | Mail goes through `nodemailer` with `SMTP_URL`. The sender is hardcoded for now: `ENV MAIL_FROM=info@story.cz` in `docker/Dockerfile.prod` and `docker/Dockerfile.dev`, which is noted in `plans/rosti-release.md`. Without `SMTP_URL` (dev), the server logs the mail (including the link) instead of sending it.                                                 |
| D9  | Forgotten password is offered in the landing page and the Visualizer. SinglePlayer is unchanged, and the route stays off `PLAY_SITE_ROUTES`.                                                                                                                                                                                                                      |
| D10 | Story settings are edited only in the Visualizer, on a whole page, and the landing page only lists, creates (on a whole page), opens, plays, exports and imports. The git settings move from their own dialog into the collapsible Git section of that page; git keeps its own save button, as it is a separate versioned resource.                               |

## 1. Protocol (`protocol/src`)

`dto/story.ts`

- `STORY_LIMITS.emailMaxLength: 255`
- `STORY_EMAIL_PATTERN` (`^[^\s@]+@[^\s@]+\.[^\s@]+$`) + `isStoryEmail`, shared by the server and client validation
- the info split (D6):
    ```ts
    export type TPublicStoryInfoDto = { access: 'public' } & Pick<TStoryDto, 'id' | 'name' | 'author' | 'description'>;
    export type TEditStoryInfoDto = { access: 'edit' } & TStoryDto & TVersioned & { hasLandingImage: boolean; email: string };
    export type TStoryInfoDto = TPublicStoryInfoDto | TEditStoryInfoDto;
    ```
    `updateStoryInfo` (and its `stale` `current`) answers `TEditStoryInfoDto`.
- `TCreateStoryBody.email?: string`; `TUpdateStoryBody.email?: string`, where `''` clears it
- `TRequestPasswordResetBody = { email: string }`
- `TResetPasswordBody = { token: string; password: string }`
- `PASSWORD_RESET_TOKEN_PARAM = 'resetToken'`
- `storyImportForm` also sets `email`

`routes.ts` — two new `GLOBAL_ROUTES`, both `public`:

```ts
requestPasswordReset: { method: 'POST', path: '/api/stories/:storyId/password-reset', access: 'public' },
resetPassword:        { method: 'PUT',  path: '/api/stories/:storyId/password-reset', access: 'public' },
```

- `TApiSpec` doc comments: D1/D2 for the request; `resetPassword` adds a grant like `login`, revokes the others, and answers `400` for an unknown or expired token
- both in `NO_CONTENT_ROUTES`
- update `protocol/__tests__/routes.test.ts` if it enumerates the routes

## 2. Server

### Config — `config/env.ts`

- `PUBLIC_URL`: optional, normalized with `normalizeOrigin`, default `http://localhost:8103`
- `SMTP_URL`: optional text
- `MAIL_FROM`: required text (it comes from the Dockerfiles); test helpers set it

### Database

- `entities/Story.ts`: `@Column({ type: 'varchar', length: 255, nullable: true }) email: string | null`
- new `entities/StoryPasswordReset.ts`: `storyId` (PK, FK → story, `ON DELETE CASCADE`, the `StoryGit` pattern), `tokenHash varchar(64)`, `expiresAt datetime(3)`, `createdAt`
- migration `<ts>-AddStoryEmail.ts`: `ALTER TABLE story ADD email varchar(255) NULL` + `CREATE TABLE story_password_reset …`, with a `down` for both
- register both in `entityRegistry.ts` / `migrationRegistry.ts`
- `StoryRepository`: `email` in `toFile` / `toColumns` (`''` ⇄ `NULL`), plus `setPassword(storyId, hash, manager)` (the version bumps)
- new `repositories/StoryPasswordResetRepository.ts`: `replace(storyId, tokenHash, expiresAt)`, `findLive(storyId, tokenHash, now)`, `delete(storyId)`, `deleteExpired(now)`
- `SessionGrantRepository.deleteForStory(storyId, manager)` (D4)
- `StoryGitRepository.setAuthorEmail(storyId, email, manager)`: bumps the git config version, so open git dialogs see `stale` (D5)

### Story file / input

- `stories/storyFile.ts`: `TStoryFile.email: string` (`''` = none); `parseStoryFile` reads it optionally (legacy `story.json` and the seed have none). `toStoryDto` stays without it.
- `stories/storyInput.ts`: an `emailField(body)` that trims, allows `''`, checks `emailMaxLength` and `isStoryEmail`. It is used in `parseNewStory` (default `''`) and `applyUpdateStoryBody`, and `'email'` is added to `UPDATE_FIELDS`. The import form passes it through as text. Also `export` the `password()` validator for the reset.
- `stories/storyInfo.ts`: `buildStoryInfo` → `TEditStoryInfoDto` (adds `access: 'edit'`, `email`), plus a new `publicStoryInfo(storyId, file)` → `TPublicStoryInfoDto`
- `StoryInfoController.getStoryInfo`: `storyGrantOf(req) ? buildStoryInfo(...) : publicStoryInfo(...)`
- `StoryInfoController.updateStoryInfo`: inside the existing transaction, when `file.email !== current.file.email && file.email !== ''`, call `storyGit.setAuthorEmail(storyId, file.email, manager)`, which is a no-op without a git row (D5). `StoriesModule` gets `StoryGitRepository` from `DatabaseModule`.

### Git — `git/GitService.ts`

- `setup`: default `authorEmail: story.email || \`${storyId}@story.local\``
- `protocol/dto/git.ts`: update the `TSetupGitBody` doc comment accordingly
- commit/merge code is unchanged; it already uses `record.authorEmail`

### Mail — new `server/src/mail/`

- `MailModule.ts`: provides `Mailer` (exported)
- `Mailer.ts`: `send({ to, subject, text })`. It uses a `nodemailer` transport from `SMTP_URL` with `from: MAIL_FROM`, or else `console.info` the whole message (D8).
- `yarn workspace @story/server add nodemailer` + `add -D @types/nodemailer`

### Password reset — `server/src/auth/`

- `passwordReset.ts`: `RESET_TOKEN_TTL_MS = 12 * 60 * 60_000`, `WRONG_EMAIL_DELAY_MS = 1_000`, `resetLink(publicUrl, storyId, token)`, `resetMail(storyName, link)` → `{ subject, text }` (it says the link is valid for 12 hours)
- `PasswordResetController.ts` (in `AuthModule`, which imports `MailModule`):
    - `requestPasswordReset`:
        1. parse `email`
        2. limiter: blocked → `429`; then `fail(key)` (every request counts)
        3. read the story → `404`
        4. no match → `await setTimeout(WRONG_EMAIL_DELAY_MS)` (`node:timers/promises`) → `400` (D1)
        5. match → `newToken()`, `replace(storyId, hashToken(token), now + TTL)`, `await mailer.send(...)`. A send failure → `500`: the user must know the mail did not go out.
    - `resetPassword`: parse `token` + `password`; hash before the transaction (as `hashUpdatePassword` does). In one transaction:
        1. `findLive` → else `400 'The link is invalid or has expired'`
        2. `setPassword`
        3. `delete` the reset row
        4. `grants.deleteForStory`

        Then `sessions.grant(...)` + set the cookie as `login` does, and `loginLimiter.succeed(loginKey)`.
- `SessionService.ts`: export `newToken`. `prune` also calls `StoryPasswordResetRepository.deleteExpired`.
- `AuthModule`: the second limiter instance (D2), `PasswordResetController`, `StoryPasswordResetRepository`

### Docker / docs

- `docker/Dockerfile.prod` (`app` stage) and `docker/Dockerfile.dev`: `ENV MAIL_FROM=info@story.cz` with a comment that it is temporary (see `plans/rosti-release.md`)
- `docker/docker-compose.prod.yml`: `PUBLIC_URL: https://${SITE_ADDRESS:-localhost}`, `SMTP_URL: ${SMTP_URL:-}`, plus a header comment line about them
- `plans/rosti-release.md`: a new "Email" item (already added)
- `docs/Server.md`: the env vars and the reset flow

## 3. Clients

### UI restructure (story settings as pages)

- The landing page no longer edits stories. The **Edit** button, `EditStoryDialog` and `StoryFormDialog` are removed. A story's settings are changed only in the Visualizer.
- The story settings in the Visualizer become a **whole page** (route `#/settings`), not a modal. `StorySettingsDialog` is removed.
- Creating a story on the landing page opens a **similar whole page** (`#/new`), not a modal. `CreateStoryDialog` is removed.
- On both pages the **Git** section is collapsible (MUI `Accordion`), collapsed by default; it is expanded on `#/settings/git` (D10).

### Shared UI — `clients/shared/ui`

Moved here from the landing page, so both apps build the same page:

- `storyForm/storyForm.ts` (from `LandingPage/src/storyForm.ts`): `TStoryFormValue` without the git fields, plus `email`. It has `EMPTY_STORY_FORM`, `storyFormOf(TEditStoryInfoDto)`, `validateStoryForm` (adds `isStoryEmail` + max length), `toCreateBody`, `toUpdateBody` (`email` always sent, so it can be cleared) and `hasErrors`.
- `storyForm/StoryFormFields.tsx` (from the landing page, without the git part): Name, Author, **Email** (`type: 'email'`, helper text _"Optional. Used as the author email of git commits and to reset a forgotten password."_), password + confirm, Description, map size (read-only in `edit`), Public switch.
- `storyForm/StoryFormPage.tsx`: the page layout. A header with the title and a **Back** button, a centered column (`maxWidth="sm"`) with `notice`, `error` and `children`, and a footer bar with **Cancel** + the submit button (label, saving label, blocked flag), like `StoryFormDialog` today.
- `CollapsibleSection.tsx`: an `Accordion` with a title, a one-line summary shown while collapsed (e.g. the remote URL, or _"Not connected"_) and controlled or uncontrolled `expanded`.
- `PasswordDialog`: an optional prop `onRequestReset?: (email: string) => Promise<void>`. When set, a small **Forgotten password?** link button appears **under the password input**. It switches the dialog content to the email step, `PasswordResetRequestForm.tsx` (a separate component): an email field, **Send link** / **Back**. The error under the field covers a wrong email (`400` message), `429` (the `passwordErrorMessage` wording) and others. On success it shows _"A link to set a new password was sent to %s. It is valid for 12 hours."_ with **Back**.
- `ResetPasswordDialog.tsx`: an info alert with the D4 text, new password + confirm (min/max from `STORY_LIMITS`, match check), `onSubmit(password): Promise<void>`, `onClose`. The server error (expired link) shows inline.
- export all of them from `index.ts`; the landing page's tests for the form move along

### Landing page — `clients/LandingPage/src`

- A tiny hash view switch in `App.tsx`: `''` → the list, `#/new` → `CreateStoryPage`. **New story** sets the hash; Back/Cancel/success return to the list.
- `CreateStoryPage.tsx` (replaces `CreateStoryDialog.tsx`): `StoryFormPage` + `StoryFormFields` (mode `create`), and when git is available a `CollapsibleSection` **Git repository** with the existing remote URL + token fields. Those move to `GitConnectFields.tsx`, with their state and validation in `gitConnectForm.ts` (the current `gitErrors` / `toGitChange`, setup only). On success: toast + back to the list, unchanged.
- `StoryCard.tsx` / `StoryList.tsx`: drop `onEdit`, the Edit button and the `EditStoryDialog` state
- delete `EditStoryDialog.tsx`, `StoryFormDialog.tsx`, `StoryFormFields.tsx`, `storyForm.ts`
- `StoriesStore.ts`: drop `loadInfo`, `saveInfo`, `loadGit`, `saveGit`; add `requestPasswordReset(email)` (for the current `prompt` story) and `resetPassword(storyId, token, password)` → sets `unlocked` and reloads
- `api.ts`: drop `getStoryInfo`, `updateStoryInfo`, `getGit`, `updateGitConfig`; add `requestPasswordReset(storyId, email)` and `resetPassword(storyId, token, password)`
- `App.tsx` also:
    - passes `onRequestReset` to `PasswordDialog`
    - on mount, reads `story` + `resetToken` from `location.search` and, when present, renders `ResetPasswordDialog` (title _"New password for %s"_)
    - on success: toast, `history.replaceState` to drop the params, and the story card shows unlocked; on close: also drops the params
- tests: `CreateStoryDialog.test.tsx` → `CreateStoryPage.test.tsx`; update `StoriesStore.test.ts`

### Visualizer — `clients/Visualizer/src`

- `shell/router.ts`: `{ page: 'settings'; section?: 'git' }`, parsed from `#/settings` and `#/settings/git`
- `Shell.tsx`: render `StorySettingsPage` for it. `TopBar.tsx`: the settings icon navigates to `#/settings` (and is highlighted there) instead of opening the modal.
- new `pages/Settings/StorySettingsPage.tsx`, built from the shared `StoryFormPage` + `StoryFormFields` (mode `edit`):
    - the landing image `ImageInput` (from `StorySettingsDialog`), written right away as today
    - `CollapsibleSection` **Git repository**, expanded when `section === 'git'`, holding the git settings form (D10)
    - **Save** runs `updateStoryInfo`; a `stale` answer shows the **Reload** / **Keep mine** alert (moved from `EditStoryDialog`). After saving, `storyInfo.reload()` + `gitStore.refresh()` (the git author email may have changed, D5) and a toast. **Cancel**/**Back** → the last route before settings (the router remembers it), else `DEFAULT_ROUTE`.
    - When `getStoryInfo` answers `access: 'public'` (no grant), it calls `auth.requireLogin()` and loads again after login
- new `pages/Settings/StorySettingsStore.ts`: the form value, `submitted` / `saving` / `error` / `conflict`, and `load` / `save` / `reload` / `keepMine` (the logic of `EditStoryDialog`, as a MobX store)
- `git/GitSettingsDialog.tsx` → `git/GitSettingsForm.tsx`: the same fields, setup/update/disconnect logic and `GitDisconnectPanel`, minus the `Dialog` shell. Its own **Connect** / **Save git settings** button stays inside the section, since git saves separately and is versioned on its own. The author email helper text: _"Set from the story email when that changes."_
- `git/gitDialogs.tsx`, `GitMenu.tsx`, `shell/GitButton.tsx`: "Git settings" navigates to `#/settings/git` instead of opening the dialog
- delete `shell/StorySettingsDialog.tsx` and `git/GitSettingsDialog.tsx`
- `api/types.ts`, `httpApi.ts`, `mockApi.ts`: add `updateStoryInfo(body)` (the mock bumps the version and keeps `email`) and `requestPasswordReset(email)` (also in `api/index.ts` as a plain request, no 401 handling)
- `getStoryInfo` callers narrow on `access`:
    - `shell/storyInfoStore.ts` (it only needs `name`)
    - `pages/Map/MapPageStore.ts` (`mapSize` only when `'edit'`)
    - `api/mockApi.ts` (`MOCK_STORY` gets `access: 'edit'`, `email: ''`)
- `api/auth.ts`: an optional `requestReset` option, exposed as `auth.requestReset`. `shell/LoginPrompt.tsx` passes `onRequestReset={auth.requestReset}`. The link in the mail opens the landing page (D7).
- tests: router parsing of `settings`; `StorySettingsStore` (load, save, stale, git refresh); update the existing `GitSettingsDialog` tests in `git/__tests__` to the form

### SinglePlayer

- no change (D9)

## 4. Tests (server, `server/__tests__`)

- `storiesApi.test.ts`:
    - create/update with `email` (valid, invalid → `400`, too long, `''` clears)
    - `getStoryInfo` on a public story without a grant → exactly `{ access, id, name, author, description }`; with a grant → full info with `email`
- `git.test.ts`:
    - changing the story email updates `story_git.authorEmail` and bumps its version
    - clearing the email leaves it
    - setup defaults to the story email
- new `passwordReset.test.ts`, with a fake `Mailer` provider in `helpers/testApp.ts` and fake timers or an injectable delay for the 1 s:
    - wrong email / story without email → `400` after the delay, no mail, no row
    - right email (case-insensitive, trimmed) → `204`, one mail whose link has `story` + `resetToken`, and the row stores the hash, not the token
    - a second request replaces the token, so the first no longer works
    - `resetPassword` with a valid token → `204`, cookie set, new password logs in, old one fails, other sessions' grants are gone, and the token can't be reused
    - expired token → `400`; a token from another story → `400`
    - limiter → `429` after 5 requests
- `storyRepository.test.ts`: `email` round trip, `NULL` ⇄ `''`
- `env` parsing of the new vars

## 5. Order of work

1. Protocol types + routes
2. Migration, entities, repositories, story file/input, `getStoryInfo` split → server tests
3. Git author sync + setup default → tests
4. Mailer + reset controller + limiter + prune + Dockerfiles → tests
5. Shared UI: move the story form, add `StoryFormPage`, `CollapsibleSection` and the password dialogs
6. Landing page: create page, remove edit, reset flow
7. Visualizer: settings route + page + store, git form out of the dialog, `getStoryInfo` callers, login prompt
8. `yarn typecheck && yarn lint && yarn test`, then a manual run: create a story with an email, unlock → forgotten password → copy the link from the server log → set the password → unlock with it; create a story on the new page; change its email in the Visualizer settings and check the git author email
