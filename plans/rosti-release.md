# Release on Roští.cz (docker stack)

Goal: run the production setup (`docker/docker-compose.prod.yml`) as a Roští.cz stack, AI included, so that user data
survives every new release.

Research: 2026-10-19, updated 2026-11-23 (AI launcher, Gemini). Source: Roští's public docs (links at the end). Items
marked **unconfirmed** must be checked on a trial stack (30 days free) or with Roští support before going live.

## TL;DR: will AI work?

| Feature                                  | Needs                                                                            | On Roští                                                                                                                                                                                                                                 |
| ---------------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Image generation (Gemini)**            | the launcher process, the Gemini key, outbound HTTPS to `generativelanguage.googleapis.com` | **Yes.** It runs in-process in the launcher (`server/aiLauncher/gemini/`) and never touches Docker. Only the compose file needs changes (`DOCKER_GID` is required today) and outbound HTTPS needs checking.                                 |
| **Claude agents (`story-ai` containers)** | the launcher with the Docker socket, `docker run` with hardening flags, the `story-ai` image on the daemon | **Very likely, unconfirmed.** A stack is "a container in which Docker runs" (nested Docker), and Roští's own docs mount `/run/docker.sock` into a compose service (custom MGM example). Five things must be checked on the trial stack (§ AI checks). |

If the agent checks fail, ship without agents: the launcher still serves images, and `/health` reports `docker: null`,
so the server marks agents unavailable (`AiAvailability`) and image generation stays on.

## What Roští stacks are (findings)

- A stack is a container with its own Docker daemon. Your compose lives at `/srv/stack/docker-compose.yml`, and the
  system compose (MGM) at `/srv/system/docker-compose.yml`, which Roští manages.
- **MGM** is a system container (Alpine, `docker-cli` + `docker-cli-compose`) with root SSH and a web terminal into the
  stack. Use it for `docker exec`, dumps, `chown`, and creating secret files. Don't list it in your compose.
- Deploy: `rosticli stack push` with `docker-compose.rosti.yml`. Images are built locally (`--platform linux/amd64`),
  then sent with `docker save | ssh | docker load`, or pulled from a registry (registry credentials go in the admin
  **Registry** tab). Then `docker compose up -d` runs. `--no-build` skips building and sending images.
- Multi-image auto-build uses each Dockerfile's folder as its build context, which doesn't fit this monorepo (the
  root is the context, and `Dockerfile.prod` has several targets). So build in CI and push to GHCR.
- **The compose file and `.env` are edited in the admin Compose tab** (new since the October research). `.env` next to the compose is supported,
  and `${VAR}` works. Changes made over SSH are overwritten by the next admin change.
- **Volumes: use bind mounts under `/srv/stack` (`./data/...`)**, not named volumes. The docs say so explicitly.
  Backups are daily filesystem snapshots of the stack, kept for 14 days. Databases need separate dumps, because a
  snapshot may be inconsistent.
- Only **port 80** is reachable from outside (443 only as TLS passthrough). The Roští proxy terminates HTTPS and gets
  Let's Encrypt certificates. Custom domains are set in the Proxy tab.
- Every resource profile limits **PIDs** and concurrent HTTP connections (over the limit returns `503`). CPU/RAM can
  go up to 12 CPU / 32 GB and can be changed from the admin panel. The base system takes about 3 GB of disk.
- Use a classic stack, not a sleepy one: agents, SSE streams and the login limiter need a process that keeps running.

## Where user data lives

| Data                                         | Today (prod compose)                     | On Roští                     |
| -------------------------------------------- | ---------------------------------------- | ---------------------------- |
| Story metadata, logins, encrypted git tokens | `mysql` named volume                     | `./data/mysql`               |
| Story files                                  | `story-prod_stories` named volume        | `./data/stories`             |
| AI transcripts (resume sessions)             | `story-ai-sessions` named volume         | `./data/ai-sessions` (see C3) |
| Secrets                                      | `docker/secrets/*` files                 | `./secrets/*` (via MGM)      |
| TLS certificates                             | `caddy_data`, `caddy_config`             | dropped (Roští proxy)        |

## Changes needed

### A. Compose: `docker/docker-compose.rosti.yml` (new, next to `docker-compose.prod.yml`)

1. `image:` instead of `build:` for `server`, `ai-launcher`, `caddy` (GHCR, pinned tag). Keep `name: story-prod`.
2. Bind mounts: `./data/stories`, `./data/mysql`, `./data/ai-sessions`. The folders must be owned by uid 1000, except
   mysql (run `chown` once from MGM).
3. Caddy: publish only `"80:80"` (short syntax, so rosticli detects the frontend). Drop the 443 ports and the
   `caddy_*` volumes.
4. Launcher:
    - `AI_STORIES_HOST_DIR=/srv/stack/data/stories` instead of `AI_STORIES_VOLUME`. The bind driver path already
      exists (dev uses it), and it also removes the need for Docker Engine ≥ 26 (`volume-subpath`). The path is how
      the stack's daemon sees the folder: **unconfirmed** that it's `/srv/stack`, check with `docker inspect` from MGM.
    - Socket: `/run/docker.sock:/var/run/docker.sock`, and `group_add: ${DOCKER_GID}`, taken from
      `stat -c %g /run/docker.sock` in MGM.
    - `AI_IMAGE=ghcr.io/<org>/story-ai:<tag>`.
5. Secrets: keep compose `secrets: file: ./secrets/...`. The files are created once over MGM SSH in
   `/srv/stack/secrets/` (`chmod 644`). **Unconfirmed:** that the admin doesn't wipe that folder on deploy. Fallback:
   read the keys from env (`.env` in the admin), which needs a small launcher/server change (`secretFile.ts`).

### B. Caddyfile: the two origins behind a TLS-terminating proxy

`SITE_ADDRESS=:80` (the October plan) **breaks the play site**. Both site blocks would collapse into `:80`, and the
blocks are told apart by host name. They also build redirects as `https://{$PLAY_SITE_ADDRESS}`. Change:

- Split the scheme from the host: the blocks become `http://{$SITE_HOST}` and `http://{$PLAY_SITE_HOST}` on Roští,
  while redirects and `ALLOWED_ORIGINS`/`PUBLIC_URL` keep `https://<host>`. Either use a separate
  `docker/Caddyfile.rosti`, or add a `SITE_SCHEME` env var to the existing file so `make prod-up` keeps working.
- Global options: `auto_https off`, plus `servers { trusted_proxies static private_ranges }`, so the login limiter
  sees the client and not Roští's proxy (**unconfirmed**: which address range the proxy uses).
- Roští Proxy tab: both `<domain>` and `play.<domain>` → the stack, port 80. DNS for both.
- `COOKIE_SECURE=1` stays (visitors use HTTPS). The server sees `X-Forwarded-Proto: https` from Caddy only if Caddy
  passes it through from the trusted proxy, so verify that cookies get set on login.

### C. AI on Roští

1. **Image generation**: no code change. Put the key in `secrets/gemini_token` and set `secrets/ai_agents.json`. Check
   that the model in `ai_agents.json` is still served (plan `ai-image-generation.md` §0.3). The launcher is on the
   `gemini-egress` network, so it needs outbound internet from the stack.
2. **Agent image delivery**: the `ai-image` service is build-only (`profiles: [build]`), so `compose up` never pulls
   it. If `story-ai` is missing, `health()` reports `image: false` and agents stay off. Options:
    - (recommended) the launcher pulls `AI_IMAGE` at startup when `docker image inspect` fails. It's a small change in
      `main.ts` / `DockerRunDriver`, it works on any host, and every release then gets the right tag.
    - or run `docker pull` from MGM after each release (a manual step that's easy to forget).
    - Private GHCR: add registry credentials in the admin Registry tab. **Unconfirmed:** that the stack's daemon
      uses them for a `docker pull` coming from the launcher, not only for compose.
3. **Sessions folder**: `AI_SESSIONS_VOLUME` only accepts a volume name. Either keep a named volume for transcripts
   (losing them only breaks "resume", and they may be missing from snapshots), or add `AI_SESSIONS_HOST_DIR` (bind)
   like `AI_STORIES_HOST_DIR`. I'd add the bind option to keep one backup story.
4. **Sizing**: each agent gets `--memory 1g --cpus 1 --pids-limit 256` (`dockerArgs.ts`). Base load (mysql, server,
   launcher, caddy) is about 1.5 GB. With `maxConcurrent` agents: RAM ≈ 1.5 GB + 1 GB × agents, and PIDs ≈ 256 ×
   agents + base. Pick a profile with headroom, or lower `maxConcurrent` in `ai_agents.json`. **Unconfirmed:** the
   PID limit per profile.
5. **Security**: the socket gives the launcher root over *the stack's* daemon, not over Roští's host. That's the
   same trust model as today, and only the launcher gets it (the server doesn't).

### D. Email, secrets, other leftovers (from the October plan)

- Replace the hardcoded `ENV MAIL_FROM=info@story.cz` in `docker/Dockerfile.prod`. Set `SMTP_URL` and
  `PUBLIC_URL=https://<domain>`.
- `.env` in the admin: `DB_PASSWORD`, `MYSQL_ROOT_PASSWORD`, `GIT_TOKEN_KEY`, `GIT_ALLOWED_HOSTS`, `SMTP_URL`,
  `DOCKER_GID`, the hosts. `GIT_TOKEN_KEY` must never change (also keep it outside Roští, next to the DB backups).

## AI checks on the trial stack (before writing the compose)

Run from MGM. Each one is a one-liner:

1. `docker version`: the daemon version. Compose secrets and `group_add` need a recent compose (fine on anything
   from the last few years).
2. `stat -c '%g %n' /run/docker.sock`: the socket's location and gid (for `DOCKER_GID`).
3. Hardening flags work in nested Docker:
   `docker run --rm --read-only --cap-drop ALL --security-opt no-new-privileges --pids-limit 256 --memory 1g --cpus 1 --user 1000:1000 alpine true`.
   `--memory` / `--cpus` fail without cgroup v2 delegation. If they fail, ask Roští, or make the limits
   configurable.
4. A bind mount from a container: `docker run --rm -v /srv/stack/data:/x alpine ls /x`. This confirms the path the
   daemon sees.
5. Egress: `wget -qO- https://generativelanguage.googleapis.com` (expect a 404 page, not a timeout), and the same
   for `api.anthropic.com`.

## Release flow

1. CI (GitHub Actions, extend `rosticli stack setup-cicd`'s `rosti.yml`) builds `--platform linux/amd64`:
   `Dockerfile.prod` targets `app`, `launcher`, `proxy`, plus `Dockerfile.ai` → GHCR, tagged with the commit SHA.
2. Update the tags in `docker-compose.rosti.yml`, then `rosticli stack push --no-build`.
3. `docker compose up -d` recreates the containers. The server applies migrations on start (`prod-entrypoint.sh`).
   The launcher pulls the new `story-ai` tag (C2) and cleans up orphaned agents.

Rules that keep the data:

1. Keep the `./data/*` paths and `name: story-prod` stable.
2. Never `down -v`, and never delete `./data` from MGM.
3. Keep `GIT_TOKEN_KEY` the same across releases.
4. Migrations are forward-only and must work with the previous version.
5. Before every release, on top of the daily snapshot:
    ```sh
    docker compose exec mysql sh -c 'mysqldump --single-transaction -uroot -p"$MYSQL_ROOT_PASSWORD" story' > story-$(date +%F).sql
    tar czf stories-$(date +%F).tgz -C /srv/stack/data stories
    ```

## Open questions for Roští support

- Is `/srv/stack/secrets/` (files created over SSH) kept across deploys and admin edits?
- Does the stack's daemon use the Registry-tab credentials for any `docker pull`, not only compose?
- What is the PID limit per profile? Is there cgroup v2 delegation for `--memory` / `--cpus` in nested containers?
- From which address range does the proxy connect (`trusted_proxies`)?
- Is outbound traffic from the stack restricted in any way?

## Next steps

- [ ] Trial stack: run the AI checks above, send the open questions to support
- [ ] Caddyfile: split scheme and host, `auto_https off`, `trusted_proxies` (B)
- [ ] Launcher: pull `AI_IMAGE` at startup when missing (C2); optional `AI_SESSIONS_HOST_DIR` (C3)
- [ ] `docker/docker-compose.rosti.yml` (A)
- [ ] GitHub Actions: four images → GHCR, `rosticli stack push --no-build`
- [ ] `MAIL_FROM`, `SMTP_URL`, `PUBLIC_URL`
- [ ] First deploy: secrets via MGM, `chown` of `./data`, DNS + Proxy tab for both hosts
- [ ] Smoke test: login, create story, play on `play.<domain>`, generate an image, run an agent, restart the stack and
      check that data and sessions persist
- [ ] Document backup/restore

## Sources

- [Roští – Container hosting (stacks)](https://rosti.cz/en/stacky-webhosting-kontejneru)
- [Roští docs – Quickstack](https://docs.rosti.cz/cs/stacks/quickstart/)
- [Roští docs – apps vs stacks](https://docs.rosti.cz/cs/stacks/apps-vs-stacks/)
- [Roští docs – MGM container](https://docs.rosti.cz/cs/stacks/mgm/)
- [Roští docs – rosticli push](https://docs.rosti.cz/cs/stacks/rosticli-push/)
- [Roští docs – multi-container](https://docs.rosti.cz/cs/stacks/rosticli-multicontainer/)
