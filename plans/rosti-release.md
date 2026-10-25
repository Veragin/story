# Release on Roští.cz (docker stack)

Goal: run the production setup (`docker/docker-compose.prod.yml`) as a Roští.cz stack so that user data survives every new release.

Research date: 2026-10-19. Source: Roští's public pages (links at the end). Items marked **unconfirmed** must be checked with Roští support before going live.

## Where user data lives

| Data                                         | Where      | Volume (prod compose)                              |
| -------------------------------------------- | ---------- | -------------------------------------------------- |
| Story metadata, logins, encrypted git tokens | MySQL      | `mysql` → `/var/lib/mysql`                         |
| Story files                                  | filesystem | `stories` → `/app/stories` (used by `server` only) |
| TLS certificates                             | Caddy      | `caddy_data`, `caddy_config` (not needed on Roští) |

The stack has three containers: `server`, `mysql` and `caddy` (which also serves the static builds of the landing page, the Visualizer and SinglePlayer).

A release replaces images and the compose file and recreates containers (`docker compose up -d`); volumes are not touched. `docker/prod-entrypoint.sh` is release-safe: it applies migrations every start and seeds the example story only into an empty database.

## What Roští stacks are (findings)

- A stack is a standard `docker-compose.yml` (CLI uses `docker-compose.rosti.yml`), deployed with `rosticli stack push`.
- Marketing page: data on volumes is kept between deployments, volumes are backed up daily, restore from the admin panel.
- Push: images are **built locally** (`--platform linux/amd64`), transferred via `docker save` | SSH | `docker load`; the compose file is uploaded as-is; then `docker compose up -d` (rolling restart). `--no-build` skips the image build/transfer.
- Multi-image mode derives each image from a Dockerfile's folder, and **the build context is that folder** — not enough for a monorepo that needs the root as context.
- Only **port 80** enters a stack from the internet; only one container may hold it. Roští's proxy terminates HTTPS (Let's Encrypt), custom domains are set in the admin panel (Proxy tab).
- Traefik is optional, run as your own container if needed (not needed: Caddy already does the routing).
- CI/CD: `rosticli stack setup-cicd` creates `.github/workflows/rosti.yml` and a `ROSTI_DEPLOY_TOKEN` repo secret; each push to `main` builds and runs `rosticli stack push`.
- Docs examples only use bind mounts (`./data:/data`, `./data/postgres:/var/lib/postgresql/data`); named volumes are not mentioned in the docs.
- Docs examples put secrets inline in the compose file; `.env` support is not documented.

## Rules for data to survive releases

1. Keep the volume names and the project name (`name: story-prod`) stable — named volumes are prefixed with it (`story-prod_mysql`); a rename means an empty database.
2. Never `docker compose down -v`, never delete volumes in the admin panel.
3. Keep `GIT_TOKEN_KEY` identical across releases (a changed key invalidates every story's stored git token).
4. Migrations: forward-only and compatible with the previous version — they run automatically on server start.
5. Back up before every release, on top of Roští's daily backup:
    ```sh
    docker compose exec mysql sh -c 'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" story' > story-$(date +%F).sql
    docker compose exec server tar czf - -C /app stories > stories-$(date +%F).tgz
    ```

## Changes needed for Roští

- **HTTP only inside the stack**: `SITE_ADDRESS=:80` (Caddy serves plain HTTP, no certificate), publish only `80:80`, drop `caddy_data` / `caddy_config`. Keep `COOKIE_SECURE=1` and set `ALLOWED_ORIGINS=https://<domain>` — visitors still use HTTPS.
- **Login limiter behind Roští's proxy**: Caddy currently drops client `X-Forwarded-For` and uses the peer, which becomes Roští's proxy → all users share one limiter bucket. Add to the Caddyfile global options:
    ```
    {
        servers {
            trusted_proxies static private_ranges
        }
    }
    ```
- **Images**: `Dockerfile.prod` needs the repo root as context and has targets (`app`, `proxy`), so rosticli's auto-build does not fit. Build in CI (or locally) and push to a registry (e.g. ghcr.io):
    ```sh
    docker build --platform linux/amd64 --target app   -f docker/Dockerfile.prod -t ghcr.io/<org>/story-app:<tag>   .
    docker build --platform linux/amd64 --target proxy -f docker/Dockerfile.prod -t ghcr.io/<org>/story-proxy:<tag> .
    ```
    `docker-compose.rosti.yml` then uses `image:` instead of `build:`, deployed with `rosticli stack push --no-build`.
- **Email (password reset)**: the sender is hardcoded as `ENV MAIL_FROM=info@story.cz` in `docker/Dockerfile.prod` (temporary). Before going live, replace it with the real sender address. Also set `SMTP_URL` (without it the server only logs the reset mails) and `PUBLIC_URL=https://<domain>` (the base of the reset link). See `plans/storyEmail-implementation.md`.
- **Secrets**: the compose file is uploaded as-is — find out how to pass `DB_PASSWORD`, `MYSQL_ROOT_PASSWORD`, `GIT_TOKEN_KEY` without committing them.

## Open questions for Roští support (unconfirmed)

- Are **named volumes** included in the daily backup, or only bind mounts in the stack directory (`./data/...`)? If only bind mounts, switch to `./data/mysql` and `./data/stories`.
- Is `.env` next to the compose file supported, or another secrets mechanism?
- From which address range does Roští's proxy connect (to confirm `trusted_proxies private_ranges`)?
- Can the stack pull images from a private registry (credentials), or must images be loaded via `rosticli`?

## Next steps

- [ ] Get answers to the open questions
- [ ] Write `docker/docker-compose.rosti.yml` (images from registry, port 80, stable volumes)
- [ ] Caddyfile: `trusted_proxies`
- [ ] Replace the hardcoded `MAIL_FROM=info@story.cz`; set `SMTP_URL` and `PUBLIC_URL`
- [ ] GitHub Actions: build `app` + `proxy`, push to registry, `rosticli stack push --no-build`
- [ ] Document backup/restore procedure

## Sources

- [Roští – Container hosting (stacks)](https://rosti.cz/en/stacky-webhosting-kontejneru)
- [Roští docs](https://docs.rosti.cz/)
- [Roští docs – rosticli push](https://docs.rosti.cz/cs/stacks/rosticli-push/)
- [Roští docs – multi-container](https://docs.rosti.cz/cs/stacks/rosticli-multicontainer/)
- [Roští docs – Traefik](https://docs.rosti.cz/cs/stacks/traefik/)
