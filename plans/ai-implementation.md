# AI agent — implementation plan

Source requirements: `plans/plan.md`. This file is the step-by-step plan for building them.

## 0. Key decisions and risks (read first)

### 0.1 Sandbox: Docker Sandboxes vs. a plain hardened container

`docker sandbox run claude` (Docker Sandboxes) is a **Docker Desktop** feature: it runs agents in microVMs on macOS/Windows.
Production here is a Linux host running `docker-compose.prod.yml`. The server itself already runs **inside** a
container. That means:

- nothing in the stack can call `docker sandbox` unless the host runs Docker Desktop;
- every docker call goes to the **host** daemon (through the mounted socket). So bind-mount paths are **host** paths,
  not container paths.

**Plan:** the sandbox sits behind an interface (`TAiSandboxDriver`, inside the launcher, 0.2) with two drivers:

| Driver           | Where                         | How                                                                                                     |
| ---------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------- |
| `docker-run`     | **prod (default)**, Linux dev | `docker run --rm -i` of a hardened `story-ai` image; only that story's `data/` and `types/` are mounted |
| `docker-sandbox` | dev on Docker Desktop         | `docker sandbox run …` with the same layout                                                             |

Phase 1 begins with a spike that checks whether `docker sandbox` can run non-interactive `claude -p` with
stream-json I/O and a given workspace. If it can't, we drop the `docker-sandbox` driver and keep only `docker-run`.
Using `docker-run` in prod is a deviation from `plan.md` ("use docker sandbox"): get it confirmed.

#### Container layout

The agent sees a fake repo with one story whose folder name is constant (`story`), so its relative engine paths resolve
exactly as on the server and the story id never appears inside the container:

```
/repo/tsconfig.base.json                 image, read-only
/repo/clients/shared/{core,utils,ui}/…   engine sources, read-only (0.1 "Engine sources")
/repo/node_modules/@types/react/…        type declarations the story tsconfig points at, read-only
/repo/node_modules/@mui/icons-material/… (only *.d.ts), read-only
/repo/stories/story/tsconfig.json        image, read-only (same content as storyTsconfig() at depth 2)
/repo/stories/story/data                 ← stories volume, subpath <storyId>/data   (rw)
/repo/stories/story/types                ← stories volume, subpath <storyId>/types  (rw)
/home/agent                              tmpfs (uid 1000, 0700, 64m)
/home/agent/.claude/projects             ← sessions volume, subpath <storyId>       (rw)
/tmp                                     tmpfs
```

- **Only `data/` and `types/` are mounted.** The story's `.git/`, `.gitignore`, `tsconfig.json`, `map.json` and
  every other top-level file are not in the container at all. This matters for security: the server runs `git` in
  the story folder, and a writable `.git/config` (filter drivers, `remote.origin.url`) would mean code execution or
  token theft on the server. Read-only permission rules are not enough because the model can be prompt-injected.
- `WORKDIR /repo/stories/story`. Anything the agent writes outside `data/`, `types/`, `/home/agent` and `/tmp` fails
  on the read-only root filesystem.
- **Engine sources** (the `enginePaths()` entries of `project/ProjectRoot.ts`, plus `tsconfig.base.json`):
    - prod: copied into the agent image at build time, so they match the deployed engine and are read-only as part of
      the `--read-only` root filesystem. A unit test checks that `Dockerfile.ai` copies every `enginePaths()` entry, so
      the two can't drift;
    - dev: bind-mounted `:ro` from `AI_REPO_HOST_DIR` over the same paths, so engine edits are seen live.
- `server/ai/agent/tsconfig.json` is checked in and baked as `/repo/stories/story/tsconfig.json`. A unit test checks
  that it equals `storyTsconfig()` for a story folder two levels below the repo root.

#### Isolation for `docker-run` (layers of defence)

- the mounts above, nothing else. Volume subpaths need Docker Engine ≥ 26. In dev, the story mounts are bind mounts
  of `<AI_STORIES_HOST_DIR>/<storyId>/{data,types}`;
- `--read-only --tmpfs /tmp --tmpfs /home/agent:rw,uid=1000,gid=1000,mode=0700,size=64m`;
- `--cap-drop ALL --security-opt no-new-privileges --pids-limit 256 --memory 1g --cpus 1`;
- `--user 1000:1000`, which matches the owner (`node`) of the story files;
- a dedicated docker network. Later hardening: an egress proxy that allows only `api.anthropic.com`;
- Claude Code tools: `--allowedTools Read,Edit,Write,Glob,Grep` **and** `--disallowedTools Bash,WebFetch,WebSearch`;
- `storyId` is checked against `STORY_ID_PATTERN` before it goes into any docker argument.

### 0.2 Docker access: the AI launcher sidecar

A docker socket proxy (e.g. `tecnativa/docker-socket-proxy`) filters only by API path. If it allows container create,
it allows `--privileged -v /:/host`, so a compromised server would still be root on the host. Instead:

- A small **`ai-launcher`** service is the **only** holder of `/var/run/docker.sock`. It is a plain Node `http`
  server (no Nest), `server/aiLauncher/`, run from a `launcher` target of `Dockerfile.prod` (the `app` image plus
  `docker-ce-cli`; the server image gets no docker CLI). It needs the socket's group (`group_add: [${DOCKER_GID}]`).
- It exposes a fixed API on an internal network (`ai-control`) that only the server joins. Agents are on `story-ai`
  and can't reach it. Every request carries `Authorization: Bearer <key>` from the shared secret `ai_launcher_key`.
- **It builds the docker argv itself** (`dockerArgs.ts`, pure, unit tested) from its own config. The server sends
  only validated parameters, never paths, flags or images.
- It reads `/secret/ai_token`. The server never sees the Anthropic token.

| Route                           | Body / response                                                                             |
| ------------------------------- | ------------------------------------------------------------------------------------------- |
| `GET /health`                   | → `{ docker: string \| null, image: boolean, token: 'api_key' \| 'oauth' \| null, driver }` |
| `POST /agents` (HTTP Upgrade)   | `{ storyId, resumeSessionId?, model?, maxBudgetUsd }` → a raw duplex NDJSON stream (below)  |
| `GET /agents`                   | → `{ containerName, storyId, pid }[]` running agents                                        |
| `DELETE /agents/:containerName` | stop one agent                                                                              |
| `DELETE /agents`                | stop and remove every container labelled `story-ai` (server boot cleanup)                   |

Validation in the launcher: `storyId` against `STORY_ID_PATTERN`, `resumeSessionId` against a UUID pattern,
`model` against `AI_MODELS`, `0 < maxBudgetUsd ≤ AI_MAX_BUDGET_USD`. Anything else → 400.

**The agent stream.** After the upgrade, the server writes NDJSON lines, which are forwarded to the CLI's stdin. The
exception is lines of `{"type":"launcher_control","action":"interrupt"}`, which the launcher handles itself (SIGINT
fallback, 2.3). The launcher writes the CLI's stdout lines unchanged, wrapped by two of its own:

- first: `{"type":"launcher","event":"started","containerName","pid"}` (`pid` = the docker client process in the
  launcher; `containerName` = `story-ai-<storyId>-<rand>`, the real handle);
- last: `{"type":"launcher","event":"exited","code","stderrTail"}`.

When the server closes the socket, the launcher stops the agent: close stdin, SIGTERM, `docker stop -t 5`, and
after 10 s `docker rm -f`. The launcher also removes every `story-ai` container when it starts, because a launcher
restart drops all the streams.

### 0.3 Driving Claude Code CLI

Run one long-lived process per story:

```
claude -p --input-format stream-json --output-format stream-json --verbose \
  --permission-mode acceptEdits \
  --allowedTools "Read,Edit,Write,Glob,Grep" --disallowedTools "Bash,WebFetch,WebSearch" \
  --max-budget-usd <remaining balance in USD> \
  [--resume <sessionId>] [--model <model>]
```

- User messages are written to stdin as NDJSON `{"type":"user","message":{"role":"user","content":"…"}}`.
- stdout is NDJSON: `system/init` (contains `session_id`), `assistant` (text and tool_use blocks), `user` (tool results),
  and `result` (contains `usage`, `total_cost_usd`, `session_id`). We parse token usage from `result`.
- In `-p` mode, built-in interactive commands such as `/clear` and `/resume` don't exist, so **the server implements
  them** (see 2.6). Skill-defined slash commands still pass through to the CLI.
- **`--max-budget-usd` is required.** The pinned CLI version must support it; the launcher refuses to spawn without
  it. The spike confirms whether it caps the whole process or a single turn (2.7).
- The container entrypoint (`docker/ai-entrypoint.sh`) copies the baked config from `/opt/agent/claude/` into the
  empty tmpfs `/home/agent/.claude/` (the sessions mount at `.claude/projects` is left alone), then `exec claude …`.

### 0.4 Token / secret

- The launcher reads `/secret/ai_token` once at start (`AI_TOKEN_FILE`) and trims it.
- `sk-ant-api…` → `ANTHROPIC_API_KEY`. **An API key is required for production**: a subscription OAuth token
  (`sk-ant-oat…` → `CLAUDE_CODE_OAUTH_TOKEN`) is not allowed for serving other users. It is accepted only in dev, and
  `/health` reports which kind it is.
- The token reaches the container as `-e ANTHROPIC_API_KEY` with no value, so docker copies it from the launcher's env
  and it never appears in argv or `ps`. The agent can still read its own env. That is acceptable because the token
  never leaves the sandbox except to Anthropic. An egress proxy that injects the key would remove even that (later).
- If the file is missing or empty, `/health` reports `token: null` and the server reports AI as **unavailable**. This
  is the same pattern as `GitAvailability` with `GIT_TOKEN_KEY`.

### 0.5 Open questions (answer before or during Phase 1)

1. **Credit unit.** Proposal: 1 credit = 1 000 tokens? Or 1 credit = $0.01 of `total_cost_usd`? The plan stores raw
   tokens **and** cost, so the conversion can change later. Default used below: **credits = ceil(cost_usd × 100)**.
2. **Who turns `aiFeature` on?** Proposal: not editable by story owners. Set it with a server script or SQL
   (`yarn workspace @story/server ai:enable <storyId> [credits]`) until billing exists.
3. **Several tabs on the same story.** Proposal: they share one agent; every tab sees the same stream.
4. **Model.** `AI_MODEL` env with a sensible default (e.g. `claude-sonnet-5-5`), which must be in the launcher's
   `AI_MODELS`.

---

## 1. Database (server/src/database)

### 1.1 Migration `AddAi<timestamp>`

Add to `migrations/` and register in `migrationRegistry.ts`:

```sql
ALTER TABLE `story` ADD `aiFeature` tinyint NOT NULL DEFAULT 0;

CREATE TABLE `story_ai_credit` (            -- one row per story, prepaid balance
  `storyId` varchar(64) NOT NULL PRIMARY KEY,
  `balance` bigint NOT NULL DEFAULT 0,      -- signed: the last turn may overdraw
  `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  FK storyId → story(id) ON DELETE CASCADE
);

CREATE TABLE `story_ai_usage` (             -- ledger, one row per agent turn (`result` message)
  `id` bigint unsigned AUTO_INCREMENT PRIMARY KEY,
  `storyId` varchar(64) NOT NULL,
  `sessionId` varchar(64) NOT NULL,
  `model` varchar(128) NOT NULL,
  `inputTokens` int unsigned NOT NULL,
  `outputTokens` int unsigned NOT NULL,
  `cacheReadTokens` int unsigned NOT NULL,
  `cacheCreationTokens` int unsigned NOT NULL,
  `costMicroUsd` bigint unsigned NOT NULL,
  `credits` int unsigned NOT NULL,
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  INDEX (`storyId`, `createdAt`),
  FK storyId → story(id) ON DELETE CASCADE
);

CREATE TABLE `story_ai_session` (           -- the 10 most recent sessions per story, for /resume
  `sessionId` varchar(64) NOT NULL PRIMARY KEY,   -- Claude Code session id
  `storyId` varchar(64) NOT NULL,
  `title` varchar(255) NOT NULL,            -- first user prompt, truncated
  `pid` int unsigned NULL,                  -- docker client process id in the launcher, while running
  `containerName` varchar(128) NULL,        -- while running
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `lastUsedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  INDEX (`storyId`, `lastUsedAt`),
  FK storyId → story(id) ON DELETE CASCADE
);
```

### 1.2 Entities and repositories

- `entities/Story.ts`: add `aiFeature: boolean`.
- New entities `StoryAiCredit.ts`, `StoryAiUsage.ts`, `StoryAiSession.ts`, registered in `entityRegistry.ts`.
- `repositories/StoryRepository.ts`: read and write `aiFeature`. Do **not** accept it from `updateStoryInfo` bodies.
- `repositories/AiCreditRepository.ts`: `balance(storyId)`, and `charge(storyId, usage)` in one transaction (insert the
  usage row, then `balance = balance - credits`), and `topUp(storyId, credits)` for the script and future billing.
- `repositories/AiSessionRepository.ts`: `upsert`, `touch`, `listRecent(storyId, 10)`, `setRunning(pid, container)`,
  `clearRunning`, and `prune(storyId, keep = 10)`. Prune returns the removed ids so their transcripts can be deleted.
- Tests next to the existing repository tests (MySQL test DB).

### 1.3 Script

`server/scripts/aiEnable.ts`: `ai:enable <storyId> [--credits N]` turns on `aiFeature` and tops up credits.

---

## 2. Server (`server/src/ai/`) and launcher (`server/aiLauncher/`)

### 2.1 Config

Server (`config/env.ts` + `ai/aiOptions.ts`):

| Env                    | Default                   | Meaning                                                                                          |
| ---------------------- | ------------------------- | ------------------------------------------------------------------------------------------------ |
| `AI_SANDBOX`           | `launcher`                | `launcher` \| `none` (`none` = dev only, runs `claude` directly, refused when `COOKIE_SECURE=1`) |
| `AI_LAUNCHER_URL`      | `http://ai-launcher:8124` | the launcher                                                                                     |
| `AI_LAUNCHER_KEY_FILE` | `/secret/ai_launcher_key` | shared secret for the launcher                                                                   |
| `AI_SESSIONS_DIR`      | `/app/ai-sessions`        | the sessions volume, mounted into the server for replay and pruning                              |
| `AI_MODEL`             | `claude-sonnet-5-5`       | passed as `model`                                                                                |
| `AI_IDLE_STOP_MS`      | `30000`                   | grace period after the last viewer leaves                                                        |
| `AI_MAX_TURN_MS`       | `300000`                  | a turn is interrupted after this long                                                            |

Launcher (`server/aiLauncher/launcherOptions.ts`):

| Env                    | Default                             | Meaning                                                             |
| ---------------------- | ----------------------------------- | ------------------------------------------------------------------- |
| `AI_TOKEN_FILE`        | `/secret/ai_token`                  | the Anthropic token file                                            |
| `AI_LAUNCHER_KEY_FILE` | `/secret/ai_launcher_key`           | shared secret with the server                                       |
| `AI_LAUNCHER_PORT`     | `8124`                              |                                                                     |
| `AI_SANDBOX_DRIVER`    | `docker-run`                        | `docker-run` \| `docker-sandbox`                                    |
| `AI_IMAGE`             | `story-ai:latest`                   | the agent image                                                     |
| `AI_STORIES_VOLUME`    | –                                   | prod: name of the `stories` volume (`story-prod_stories`)           |
| `AI_STORIES_HOST_DIR`  | –                                   | dev: host path of `stories/` (bind mounts are resolved on the host) |
| `AI_REPO_HOST_DIR`     | –                                   | dev: host path of the repo, for the read-only engine mounts         |
| `AI_SESSIONS_VOLUME`   | `story-ai-sessions`                 | volume holding `~/.claude/projects` per story (`volume-subpath`)    |
| `AI_NETWORK`           | `story-ai`                          | docker network of the agents                                        |
| `AI_MODELS`            | `claude-sonnet-5-5,claude-opus-5-5` | allowed `model` values                                              |
| `AI_MAX_BUDGET_USD`    | `5`                                 | upper bound for `maxBudgetUsd` of one agent process                 |

### 2.2 Files

```
server/src/ai/
  AiModule.ts            imports DatabaseModule, StoriesModule, StoryContextModule
  AiAvailability.ts      OnModuleInit: launcher /health (docker, image, token); retries every 30 s while unavailable; logs the reason
  aiOptions.ts           AI_OPTIONS provider from config
  AiController.ts        protocol routes (2.5)
  AiService.ts           feature/credit checks, command dispatch, session list
  AiAgents.ts            registry storyId → AiAgent; viewer ref-counting, idle stop, StoryLifecycle hooks, OnApplicationShutdown, boot cleanup
  AiAgent.ts             one agent stream: writer, NDJSON parser, state, in-memory transcript, files touched this turn, subscribers
  streamJson.ts          types + parser of Claude Code stream-json messages → TAiEvent
  usage.ts               result.usage/total_cost_usd → TAiUsage + credits
  aiCommands.ts          parses "/clear", "/resume [n]", "/help", "/cost"
  aiEventStream.ts       SSE writer (same shape as events/sse.ts: heartbeat, retry)
  agentConnection/
    TAgentConnection.ts  type: open(params) → duplex NDJSON stream + started/exited events; stop(); cleanupAll()
    LauncherConnection.ts  HTTP Upgrade client of the launcher
    LocalConnection.ts   AI_SANDBOX=none: spawns `claude` directly

server/aiLauncher/
  main.ts                http server, bearer auth, routes (0.2)
  launcherOptions.ts
  launchRequest.ts       validation of POST /agents bodies
  aiToken.ts             reads/classifies the token file
  AgentProcesses.ts      running agents, stop sequence, orphan cleanup, interrupt
  sandbox/
    TAiSandboxDriver.ts  type: spawn(params) → { child, pid, containerName }; stop(containerName); cleanupOrphans()
    DockerRunDriver.ts
    DockerSandboxDriver.ts
    dockerArgs.ts        pure builder of the `docker run` argv (unit tested: mounts, read-only, tmpfs, no extra paths)

server/src/stories/
  StoryLifecycle.ts      listeners for beforeFolderSwap(storyId) / beforeDelete(storyId) (2.3)
```

Register `AiModule` in `AppModule.ts`.

### 2.3 Agent lifecycle (`AiAgents` / `AiAgent`)

- **Start:** when the first viewer opens `GET /ai/events` (the sidebar opened), and only if `aiFeature`, availability,
  and `balance > 0` all hold. Otherwise the stream sends a `status` event with the reason and does not spawn.
  Resume the most recent session by default? **No.** Start fresh, and let `/resume` choose. (Simpler, and it matches CLI behaviour.)
  Before spawning, the server creates `<AI_SESSIONS_DIR>/<storyId>` so the volume subpath exists.
- **One agent per story.** Later viewers attach to the running agent and first receive a `snapshot` (status +
  in-memory transcript).
- **PID tracking:** `pid` and `containerName` from the launcher's `started` line are kept on `AiAgent` and
  written to `story_ai_session.pid/containerName` once `system/init` reports the session id. They are cleared on exit.
- **Stop:** when the viewer count drops to 0, start a timer for `AI_IDLE_STOP_MS`. That covers page reloads. Once
  it fires, close the stream; the launcher runs the stop sequence (0.2). The SSE stream already ends at grant expiry
  (`endAtExpiry`), so logging out also stops the agent.
- **Crash or exit:** emit `status: stopped` with the `stderrTail`; viewers can send a message to restart it, which
  resumes the same session.
- **Server shutdown:** `OnApplicationShutdown` stops every agent. **Boot:** `DELETE /agents` on the launcher and clear
  stale `pid` columns.
- **Story folder swapped or deleted.** `StoryFolders.replace()` (git setup) renames the story folder away; a running
  container keeps its mounts on the old folder, which is then removed, and the agent's edits would vanish. So:
    - `StoryLifecycle` (in `StoriesModule`, so there is no module cycle) holds async listeners; `AiAgents` registers on
      module init;
    - `StoryFolders.replace()` awaits `lifecycle.beforeFolderSwap(storyId)` before the rename, so every future caller is
      covered. `AiAgents` stops the agent (a running turn is interrupted) and emits `status: stopped` with "The story
      folder was replaced". The next message restarts it on the new folder and resumes the same session;
    - the story delete path awaits `lifecycle.beforeDelete(storyId)`: stop the agent, delete `<sessions>/<storyId>`.
      DB rows cascade;
    - in-place bulk rewrites (git merge/switch, `addFiles`) keep the mounts valid and don't stop the agent (2.4).
- **Turn guard:** one turn at a time. A message sent while busy gets `409 ai_busy`. `POST /ai/interrupt` sends a
  stream-json interrupt control request if the CLI supports it; otherwise a `launcher_control` interrupt line, and the
  launcher sends SIGINT. The same happens when a turn exceeds `AI_MAX_TURN_MS`.

### 2.4 Files written by the agent; concurrent edits

The story's chokidar watcher (`events/watcher.ts`) watches exactly `data/` and `types/`, the only folders the agent
can write. It already pushes `change` events to the Visualizer, so there is no reload after each turn. If the spike
shows the in-memory `SourceProject` gets stale anyway, call `StoryReloader.afterBulkRewrite(ctx, 'ai')` after each
`result` instead of writing a new reload path (then add `'ai'` to `STORY_EVENT_REASONS`).

**The user may keep editing while the agent works.** Nothing is locked. Each side picks up the other's changes:
Claude Code's `Edit` refuses to apply to a file that changed since the agent last read it, and the Visualizer gets the
agent's writes through the watcher. The remaining risk is a Visualizer form with unsaved changes overwriting a file
the agent just edited (last writer wins). The chat shows this risk (5.3, `AiActivity`). To support that, `AiAgent`
collects the paths of `Edit`/`Write` tool calls of the running turn and sends them in `activity` events.

### 2.5 Protocol routes (`protocol/src/routes.ts`, all `access: 'write'`)

| Name             | Method / path        | Body / response                                                                                    |
| ---------------- | -------------------- | -------------------------------------------------------------------------------------------------- |
| `getAi`          | `GET /ai`            | → `TAiDto { available, enabled, credits, status, sessionId }`                                      |
| `aiEvents`       | `GET /ai/events`     | SSE of `TAiEvent`; holding it open keeps the agent alive                                           |
| `sendAiMessage`  | `POST /ai/messages`  | `{ text }` → `TOkDto`; `402 ai_no_credits`, `409 ai_busy`, `403 ai_disabled`, `503 ai_unavailable` |
| `interruptAi`    | `POST /ai/interrupt` | → `TOkDto`                                                                                         |
| `listAiSessions` | `GET /ai/sessions`   | → `TAiSessionDto[]` (≤ 10, newest first)                                                           |
| `resumeAi`       | `POST /ai/resume`    | `{ sessionId }` → `TOkDto`                                                                         |
| `clearAi`        | `POST /ai/clear`     | → `TOkDto`                                                                                         |

New `protocol/src/dto/ai.ts`:

```ts
export type TAiStatus =
    | 'unavailable'
    | 'disabled'
    | 'no_credits'
    | 'stopped'
    | 'starting'
    | 'ready'
    | 'busy'
    | 'error';
export type TAiMessageDto =
    | { kind: 'user'; id: string; text: string; at: string }
    | { kind: 'assistant'; id: string; text: string; at: string }
    | { kind: 'tool'; id: string; tool: string; summary: string; at: string } // "Edited data/chapters/start/…"
    | { kind: 'system'; id: string; text: string; at: string }; // command output, errors
export type TAiEvent =
    | {
          type: 'snapshot';
          status: TAiStatus;
          credits: number;
          sessionId: string | null;
          messages: TAiMessageDto[];
          touchedFiles: string[];
      }
    | { type: 'status'; status: TAiStatus; message?: string }
    | { type: 'message'; message: TAiMessageDto }
    | { type: 'activity'; touchedFiles: string[] } // story-relative paths edited in the running turn; [] when the turn ends
    | {
          type: 'usage';
          credits: number;
          turnCredits: number;
          tokens: TAiTokensDto;
      };
```

Add the new error codes to `dto/errors.ts`, with messages in the client's `errorBodyMessage`. `TEditStoryInfoDto`
gets `aiFeature: boolean` so the Visualizer knows whether to show the button.

### 2.6 Commands (`aiCommands.ts`, handled server-side in `sendAiMessage`)

| Input         | Effect                                                                                |
| ------------- | ------------------------------------------------------------------------------------- |
| `/clear`      | stop the process, start fresh (no `--resume`), send an empty `snapshot`               |
| `/resume`     | answer with a `system` message listing the 10 sessions (n. title · date)              |
| `/resume <n>` | restart with `--resume <sessionId>`, replay that session's transcript as a `snapshot` |
| `/cost`       | `system` message: credits left, the session's tokens                                  |
| `/help`       | `system` message listing the commands                                                 |
| other `/x`    | passed through to the CLI (skill commands)                                            |

Replaying a session reads `<AI_SESSIONS_DIR>/<storyId>/-repo-stories-story/<sessionId>.jsonl` (Claude Code's
folder name for the constant workdir) and maps it with the same `streamJson.ts` mapper.

### 2.7 Credits and usage

- Before each user message: `aiFeature` set, else 403; `balance > 0`, else `402 ai_no_credits`. The message is
  rejected and the client shows the error.
- **Spend cap:** every spawn passes `maxBudgetUsd = min(balance in USD, AI_MAX_BUDGET_USD)`, so a single agent
  process can't spend more than the story has. A top-up takes effect when the agent next starts. If the spike shows
  the flag caps a single turn instead of the process, compute it again for each turn by restarting with `--resume`
  whenever the balance has dropped below the cap passed at spawn.
- `AI_MAX_TURN_MS` (5 min) bounds runaway turns in time as well.
- On each `result`: `usage.ts` turns it into tokens + `costMicroUsd` + credits, then
  `AiCreditRepository.charge()`, `AiSessionRepository.touch()`, and emits a `usage` event. A turn stopped by the budget
  cap is charged like any other and ends with a `system` message.
- If the balance drops to ≤ 0 mid-session, the current turn finishes and the next one is refused.

### 2.8 Session history (10 per story)

- On `system/init`: upsert `story_ai_session` (title = first user prompt, ≤ 120 chars).
- After the upsert, `prune(storyId, 10)` removes older rows and deletes their `.jsonl` transcripts directly in
  `AI_SESSIONS_DIR` (the server mounts the sessions volume).

---

## 3. Agent image and skills

- `docker/Dockerfile.ai`: `FROM node:22-slim`, then `npm i -g @anthropic-ai/claude-code@<pinned, with --max-budget-usd>`,
  non-root user `agent` (uid 1000), `WORKDIR /repo/stories/story`, `ENTRYPOINT ["/usr/local/bin/ai-entrypoint.sh"]`.
  Disable telemetry and auto-updates (`DISABLE_AUTOUPDATER=1`, `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`).
- Engine sources and type declarations are copied to `/repo/…` (0.1 "Container layout"). Build context: the repo root.
- `/home/agent` is a tmpfs at run time, so the config is baked into **`/opt/agent/claude/`** and copied into
  `/home/agent/.claude/` by `ai-entrypoint.sh` on every start:
    - `server/ai/agent/CLAUDE.md` → `CLAUDE.md` (role: editing an interactive story; only `data/` and `types/` are
      writable; engine sources under `/repo/clients/shared` are for reference; keep files typecheckable; never mention
      the sandbox);
    - `server/ai/agent/skills/story-files/SKILL.md`: the folder layout (`data/chapters/<id>/*.chapter.ts`,
      `*.passages.ts`, `*.passages/`, `characters/`, `items/`, `locations/`, `npcs/`, `register.ts`, `types/`) and
      where the engine API lives (`@story/core` → `/repo/clients/shared/core/src`). Source it from `server/template/`
      and `docs/`;
    - `skills/passages/SKILL.md`, `skills/entities/SKILL.md`, `skills/structure/SKILL.md`: conventions the server
      readers and writers expect (`server/src/project/readers|writers`), with examples;
    - `settings.json`: `permissions.allow` = edit tools, `deny` = `Bash`, `WebFetch`, `WebSearch`.
- `server/ai/agent/tsconfig.json` → `/repo/stories/story/tsconfig.json` (tested against `storyTsconfig()`).
- Mounts: see 0.1. Nothing else from the story folder.
- Build: a `make ai-image` target. Prod compose builds it as a separate service image (`profiles: [build]`).

---

## 4. Docker / compose

**Prod** (`docker/docker-compose.prod.yml`):

- secrets: `ai_token: { file: ./secrets/ai_token }` mounted into **`ai-launcher`** only, at `/secret/ai_token`;
  `ai_launcher_key: { file: ./secrets/ai_launcher_key }` (`openssl rand -hex 32`) mounted into `server` and
  `ai-launcher`. Add `docker/secrets/` to `.gitignore` and `.dockerignore`;
- `ai-launcher` service: `Dockerfile.prod` target `launcher`, mounts `/var/run/docker.sock`, `group_add:
[${DOCKER_GID}]`, network `ai-control` (internal) only, no published ports. Env `AI_STORIES_VOLUME=story-prod_stories`
  (or set `name:` on the volume so the name is fixed), `AI_SESSIONS_VOLUME`, `AI_NETWORK`, `AI_MODELS`;
- `server`: joins `ai-control`, gets `AI_LAUNCHER_URL`, and mounts the `story-ai-sessions` volume at
  `/app/ai-sessions`. The server has no docker socket and no docker CLI;
- the `story-ai` network (agents only, internet egress) and the `story-ai-sessions` volume;
- update the header comment and `docker/.env.example` (`DOCKER_GID`, the two secret files).

**Dev** (`docker/docker-compose.yml`):

- an `ai-launcher` service with the same command, mounting `/var/run/docker.sock` and the repo. The dev container
  gets no socket;
- `AI_STORIES_HOST_DIR` and `AI_REPO_HOST_DIR` set explicitly in `docker/.env` (absolute host paths; `${PWD}`
  depends on where compose runs);
- mount `./secrets/ai_token` → `/secret/ai_token` into the launcher if present (optional, so AI stays "unavailable"
  without it); a fixed dev `ai_launcher_key`;
- devs on Docker Desktop may set `AI_SANDBOX_DRIVER=docker-sandbox`.

---

## 5. Visualizer client (`clients/Visualizer/src`)

### 5.1 API

- `api/types.ts` + `api/httpApi.ts`: the seven routes.
- `api/mockAiApi.ts`: scripted fake agent for the mock mode and tests (same pattern as `mockGitApi.ts`).
- `api/aiEvents.ts`: EventSource wrapper for `/ai/events` with reconnect. Reuse `api/events.ts` helpers; extract the
  shared reconnect/backoff into a small utility if a third copy would appear.

### 5.2 Store: `ai/AiStore.ts` (mobx, instance in `context.ts`)

- State: `open`, `status`, `credits`, `messages`, `sessionId`, `draft`, `lastError`, `sessions`, `touchedFiles`.
- `setOpen(open)`: opening connects the stream (the server starts the agent); closing disconnects it (the server stops
  the agent after the grace period). Leaving the Visualizer closes the EventSource, which is the "user leaves the
  story" case.
- `send(text)`: optimistic `user` message; on `ai_no_credits` / `ai_busy` set `lastError`.
- Computed: `canSend`, `noCredits` (`credits <= 0 || status === 'no_credits'`), `working` (`status === 'busy' ||
status === 'starting'`).
- The open state persists through `ui-state.ts`, wrapped in try/catch like the existing entries.
- Tests: `ai/__tests__/AiStore.test.ts` against `mockAiApi`.

### 5.3 Components (one per file)

| File                     | Role                                                                                                                                                                                                                                                      |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `shell/AiButton.tsx`     | top-bar toggle next to `GitButton`; hidden unless `storyInfo.info.aiFeature` and `ai.available`; `SmartToy` icon, "active" style while open                                                                                                               |
| `ai/AiSidebar.tsx`       | left column: header, message list, activity bar, input; width via existing `ResizableSplitter`                                                                                                                                                            |
| `ai/AiSidebarHeader.tsx` | title `Ai agent`, credit count chip, status dot, close button                                                                                                                                                                                             |
| `ai/AiMessageList.tsx`   | scrollable list, auto-scrolls to the bottom unless the user scrolled up                                                                                                                                                                                   |
| `ai/AiMessage.tsx`       | one bubble per `TAiMessageDto.kind` (assistant text `white-space: pre-wrap`; tool rows compact)                                                                                                                                                           |
| `ai/AiActivity.tsx`      | bar directly above the input, always visible. Idle: "Agent is idle". Working: spinner + "Agent is working", and a warning: "Don't edit the files it is changing until it finishes", listing `touchedFiles` (collapsed after 3). Stopped/error: the reason |
| `ai/AiInput.tsx`         | multiline textarea at the bottom; Enter sends, Shift+Enter adds a newline; disabled while busy or without credits; stop button while busy                                                                                                                 |
| `ai/AiCommandHints.tsx`  | small popup of `/clear`, `/resume`, `/cost`, `/help` while the draft starts with `/`                                                                                                                                                                      |
| `ai/AiNoCredits.tsx`     | error message via `components/feedback/ErrorAlert` when no credits are left                                                                                                                                                                               |
| `ai/aiCommands.ts`       | the command list (name + description), shared by the hints and `/help`                                                                                                                                                                                    |

`shell/Shell.tsx`: wrap the page area in a `Row`: `{ai.open && <AiSidebar />}` + `SPage`, so the sidebar sits
below the top bar on the left. `shell/TopBar.tsx`: render `<AiButton />` right after `<GitButton />`.

Editing elsewhere in the Visualizer stays enabled while the agent works (2.4); `AiActivity` is the only warning.

Markdown in assistant replies: plain pre-wrapped text in v1. Add a markdown renderer later if needed (it would be
a new dependency).

### 5.4 Tests

`AiButton` (hidden/visible), `AiInput` (Enter/Shift+Enter, disabled states), `AiActivity` (idle / working with the
warning and touched files / stopped reason), `AiSidebar` (no-credits alert, messages render), `AiStore` (stream events →
state, `activity` events, commands, errors).

---

## 6. Docs

- `docs/Server.md`: the AI module, the launcher and its API, both env tables, sandbox drivers, the container layout,
  the security model, the lifecycle (including folder swaps).
- `docs/Visualizer.md`: the sidebar, the activity bar, and its commands.
- `docker-compose.prod.yml` header and `.env.example`: the secret files, the volumes, the launcher, `DOCKER_GID`.

---

## 7. Phases (each ends green: `yarn typecheck && yarn lint && yarn test`)

1. **Spike (½–1 day):** build `story-ai`, run `claude -p` stream-json by hand through `docker run` with the 0.1
   layout. Confirm: the init/result message shapes, `--resume` with a persisted projects dir and the transcript folder
   name, the interrupt mechanism, `volume-subpath` for `<storyId>/data`, that Claude Code runs with a tmpfs HOME and
   the entrypoint copy, `--max-budget-usd` semantics (process vs. turn), that `Edit` refuses stale files, that the
   watcher alone keeps `SourceProject` current, and stdin/stdout through an HTTP Upgrade stream. Try `docker sandbox`
   on Docker Desktop. Write the findings back here.
2. **DB:** migration, entities, repositories, `ai:enable` script, repository tests.
3. **Protocol:** `dto/ai.ts`, routes, error codes, `aiFeature` in `TEditStoryInfoDto`.
4. **Launcher:** options, token, `dockerArgs` (unit tests on argv: only the allowed mounts, read-only, tmpfs HOME,
   disallowed tools, budget), request validation, bearer auth, `DockerRunDriver`, stop sequence, orphan cleanup.
5. **Server core:** options, availability, `LauncherConnection` + a fake connection, `streamJson` parser (fixture
   tests from spike output), `AiAgent` (touched files), `AiAgents` (fake connection tests: start, attach, idle stop,
   crash, shutdown, boot cleanup, folder swap, delete).
6. **Server API:** controller, service, commands, credits charging and budget cap, session history and pruning,
   `StoryLifecycle` hooks in `StoryFolders.replace()` and the delete path. Controller tests with the fake connection.
7. **Agent image + skills:** Dockerfile, entrypoint, CLAUDE.md, skills, tsconfig + engine copy tests; manual check
   that the agent edits a passage and the Visualizer updates live.
8. **Compose:** dev and prod wiring, secrets, launcher service, networks, Makefile target.
9. **Visualizer:** API + mock, store, components (incl. `AiActivity`), Shell/TopBar wiring, tests.
10. **Hardening + docs:** egress restriction, rate limit on `sendAiMessage`, docs.

## 8. Acceptance checklist

- [ ] Without `/secret/ai_token` in the launcher, `getAi` reports `available: false` and no button shows.
- [ ] A story with `aiFeature = false` shows no button; the API answers 403.
- [ ] Opening the sidebar starts exactly one container per story; a second tab attaches to it.
- [ ] Closing the sidebar or leaving the Visualizer stops the container after the grace period; the PID and
      container columns are cleared.
- [ ] From inside the agent, other stories, the server, the story's `.git/` and its top-level files are not
      reachable, and nothing outside `data/` and `types/` is writable. Test it by asking the agent to read
      `../demo/...`, `/app/...` and `.git/config`, and to write `/repo/stories/story/x` and an engine file.
- [ ] The server container has no docker socket; the launcher rejects requests without the key and with invalid
      parameters.
- [ ] Every turn adds a `story_ai_usage` row and lowers `story_ai_credit.balance`; the header updates.
- [ ] An agent can't spend more than the balance it started with (budget cap).
- [ ] With a balance ≤ 0, the input is disabled and the error message shows; the API answers 402.
- [ ] `/clear` starts a new session; `/resume` lists ≤ 10 sessions; `/resume 2` restores one with its history.
- [ ] Edits made by the agent appear in the Visualizer without a reload.
- [ ] While the agent works, the bar above the input says so, warns not to edit, and lists the files it is changing;
      the rest of the Visualizer stays editable.
- [ ] Git setup (folder swap) on a story with a running agent stops it first; after the next message, the agent's
      edits land in the new folder.
- [ ] A server restart leaves no orphaned `story-ai` containers.

## 9. Implementation status

Phases 2–10 are implemented and uncommitted on `visualiser-improvments` (2026-11). Phase 1, the spike, has not run:
there was no Docker where this was built. The docs are `docs/Server.md#ai-agent` (server, launcher, image, security,
lifecycle, credits, sessions, `ai:enable`, and the list "Unverified until the spike") and `docs/Visualizer.md#ai-agent`.

### Done

- **DB**: migration `AddAi`, the three entities, `AiCreditRepository`, `AiSessionRepository`, `aiFeature` on `story`,
  `ai:enable <storyId> [--credits N]`, repository tests.
- **Protocol**: `dto/ai.ts`, the seven routes (all `write`), the four `ai_*` error codes, `aiFeature` in
  `TEditStoryInfoDto`.
- **Launcher** (`server/aiLauncher/`): options, token classification, bearer auth, request validation, `dockerArgs`,
  `DockerRunDriver`, `DockerSandboxDriver`, the NDJSON upgrade stream, the stop sequence, orphan cleanup, tests (no
  docker needed).
- **Server** (`server/src/ai/`): availability, `LauncherConnection`, `LocalConnection`, the stream-json parser,
  `AiAgent`, `AiAgents`, `AiService`, commands, charging, the budget cap, session history and pruning,
  `StoryLifecycle` with `beforeFolderSwap` in `StoryFolders.replace()`, controller tests on `FakeAgentConnection`.
- **Image**: `Dockerfile.ai`, `ai-entrypoint.sh`, `server/ai/agent/` (CLAUDE.md, settings, four skills, tsconfig),
  `agentImage.test.ts`.
- **Compose**: dev and prod `ai-launcher`, secrets, `ai-control`, the sessions volume, the `ai-image` build service,
  `make ai-image`, `.gitignore` / `.dockerignore` for `docker/secrets/`.
- **Visualizer**: API + `mockAiApi`, `AiStore`, the sidebar and its parts, `AiButton`, Shell / TopBar wiring, tests.
- **Phase 10**: the rate limit on `sendAiMessage` and the docs. The egress restriction is not done (below).

### Deviations from this plan

- **Tools**: `Skill` is allowed besides `Read, Edit, Write, Glob, Grep` (`--allowedTools` and `settings.json`), or
  the skills could not load.
- **`AI_INSTANCE`** (new launcher env, default `prod`, dev `dev`): every container also gets the label
  `story-ai.instance`, and orphan cleanup / `DELETE /agents` remove only their own instance's containers, so a dev and
  a prod launcher on one host do not kill each other's agents.
- **The agent network** is created by the launcher at startup (`docker network create`, a plain bridge) instead of
  being declared in compose.
- **Stories mount**: exactly one of `AI_STORIES_VOLUME` and `AI_STORIES_HOST_DIR` must be set, else the launcher
  exits (AI is unavailable in dev until `docker/.env` has the host paths). Engine bind mounts from
  `AI_REPO_HOST_DIR` are added only in the bind (dev) mode; the image copies `clients/shared/{core,utils,ui}/src`, while
  dev binds the package folders.
- **Launcher API details**: `POST /agents` without an upgrade is 426; no token is 503 `token_unavailable`; a spawn
  error is 500 `spawn_failed`; the body is ≤ 16 KB within 10 s; `DELETE /agents` answers `{ removed }`. Container
  names are `story-ai-<storyId>-<8 hex>`.
- **Interrupt**: both mechanisms, in order: the stream-json `control_request` first, the `launcher_control` SIGINT
  3 s later if the turn has not ended.
- **Budget cap**: computed only at spawn. The per-turn recompute (2.7, "if the spike shows the flag caps a turn")
  is not implemented.
- **API key in prod**: the launcher accepts both token kinds; the server (`requireApiKey`, from `COOKIE_SECURE`)
  reports AI unavailable when the launcher holds a subscription token.
- **Availability** is re-checked every 30 s only while unavailable; once available it is not polled again.
- **No credits**: viewers still attach and see the transcript, only the process is not started.
- **Rate limit**: `AI_MESSAGES_PER_MINUTE` (default 20) per story, through the existing `LoginLimiter` (token
  `AI_MESSAGE_LIMITER`), answering the existing 429 `too_many_requests` instead of a new `ai_rate_limited` code.
  Commands count too. In memory: a restart resets it.
- **Pruning** also removes a session's `<sessionId>/` folder next to its `.jsonl`.
- **Dev wiring**: the launcher key is the checked-in `docker/ai-launcher-dev.key` (no secret), the token is
  `docker/secrets/ai_token` through `AI_TOKEN_FILE`, the sessions volume is `story-ai-sessions-dev` at `/ai-sessions`,
  and `Dockerfile.dev` gained a `launcher` stage (`docker/install-docker-cli.sh`, shared with `Dockerfile.prod`).
- **Server `AI_MODEL`** is not passed through the prod compose: it stays at its default, which `AI_MODELS` must
  include.
- **No `StoryReloader` call after a turn**: the watcher is assumed to be enough (2.4), pending the spike.
- **Visualizer**: the sidebar resizes with `SplitterHandle` + `useDragResize`, extracted from `ResizableSplitter`
  (which now uses them too), instead of `ResizableSplitter` itself; `AiTouchedFiles` is an extra component for the
  file list; the sidebar shows while `open && available && enabled`, and the button also needs edit access. The
  reconnect logic was extracted into `api/ReconnectingEventSource.ts`, shared by `events.ts` and `aiEvents.ts`.
  The sidebar width is kept in `ui-state` too.
- **Fixtures** for the stream-json parser are hand-written, not captured from a run (Phase 1 did not happen).

### Still open

- **The Phase 1 spike.** Nothing has run against a real Docker or `claude`. Every item of "Unverified until the
  spike" in `docs/Server.md` (stream-json shapes, interrupt, `--max-budget-usd` semantics, tmpfs HOME, `volume-subpath`,
  the `docker-sandbox` driver, `LocalConnection`) and the acceptance checklist (section 8, all unchecked) wait for it.
  Write the findings back here and replace the fixtures with captured output.
- **The egress proxy**: the `story-ai` network has full internet access. An allow-list proxy for `api.anthropic.com`
  (ideally one that injects the key, so the token leaves the container entirely) is still to do.
- **Story deletion calling `beforeDelete`**: `AiAgents` listens on `StoryLifecycle.beforeDelete` (stop the agent,
  delete the story's sessions folder), but the server has no story delete path yet, so nothing calls it. The future
  delete route must await `lifecycle.beforeDelete(storyId)` before removing the folder.
