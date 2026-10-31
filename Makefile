COMPOSE = docker compose -f docker/docker-compose.yml
# One `docker compose exec` into the dev container, at /app. Every dev target below is
# this plus a yarn script, so they all share the container `make bash` is exec'd into.
# Split in two because `docker compose exec` only accepts flags *before* the service name,
# so `-d` cannot be appended to a variable that already ends in one.
DEV_EXEC_FLAGS = -w /app
DEV_EXEC = $(COMPOSE) exec $(DEV_EXEC_FLAGS) story-template
DEV_EXEC_DETACHED = $(COMPOSE) exec -d $(DEV_EXEC_FLAGS) story-template

# Where `make start` parks the output of the detached `yarn dev`. The dev servers are not
# PID 1 (the container's command is an idle `tail`), so `docker compose logs` cannot show them.
# `/app` is the bind mount, so this file is also readable straight from the host.
DEV_LOG = .dev.log

.PHONY: start up stop bash destroy build dev dev-player dev-visualizer dev-server dev-landing-page dev-multi-engine logs prod-up prod-down prod-logs

# The Phase 11 gate: brings up every service (8100 SinglePlayer, 8101 Visualizer client,
# 8102 MultiEngine client, 8103 landing page, 8123 server). The server needs the mysql service; on
# start it seeds the example and demo stories' database rows when missing (server/scripts/dev.ts).
# The container stays idle at PID 1 and `yarn dev` runs as a detached exec inside it, so a dev
# server that dies cannot take `make ai` / `make bash` down with it.
start: ai-setup-update stop
	$(COMPOSE) up -d --build --remove-orphans
	$(DEV_EXEC_DETACHED) bash -c 'yarn dev > $(DEV_LOG) 2>&1'
	@echo ""
	@echo "  Stories (landing)   http://localhost:8103  (start here: create, open, play, export)"
	@echo "  SinglePlayer        http://localhost:8100"
	@echo "  Visualizer client   http://localhost:8101"
	@echo "  Server (NestJS)     http://localhost:8123  (/api/health, /api/stories …; needs MySQL)"
	@echo "  MultiEngine client  http://localhost:8102"
	@echo ""
	@echo "  logs: make logs     one service instead: make up, then make dev-player"

# The container without the services. Use this when you want a single service — `make start`
# already holds all five ports, and vite is `strictPort`, so it would refuse rather than
# silently pick another one.
up:
	$(COMPOSE) up -d --build --remove-orphans

stop:
	$(COMPOSE) down

bash:
	$(COMPOSE) exec -w /app story-template bash

destroy:
	$(COMPOSE) down -v

logs:
	$(DEV_EXEC) tail -f $(DEV_LOG)

# Foreground equivalents of the above, for when you want the output attached and Ctrl-C to
# stop things. Run them against `make up` (not `make start`), or the ports are already taken.
dev:
	$(DEV_EXEC) yarn dev

dev-player:
	$(DEV_EXEC) yarn dev:player

dev-visualizer:
	$(DEV_EXEC) yarn dev:visualizer

# The NestJS server on :8123 (needs the mysql service). Every client proxies /api to it.
dev-server:
	$(DEV_EXEC) yarn dev:server

# The landing page (story list) on :8103. Like the client, it proxies /api to the server.
dev-landing-page:
	$(DEV_EXEC) yarn dev:landing-page

dev-multi-engine:
	$(DEV_EXEC) yarn dev:multi-engine

# Production (multiple stories, phase 11): Caddy on 80/443 in front of the server and
# SinglePlayer, which gets an origin of its own (docker/docker-compose.prod.yml). Run on the host, not
# inside the dev container. Needs `docker/.env` (copy `docker/.env.example`, set the DB passwords).
# SITE_ADDRESS is the public host name, e.g. `make prod-up SITE_ADDRESS=stories.example.com` (default
# localhost); the play site is `play.<SITE_ADDRESS>` unless PLAY_SITE_ADDRESS says otherwise.
# `prod-down` keeps the volumes (the stories, the database, Caddy's certificates).
PROD_COMPOSE = docker compose -f docker/docker-compose.prod.yml

prod-up:
	SITE_ADDRESS=$(or $(SITE_ADDRESS),localhost) $(PROD_COMPOSE) up -d --build --remove-orphans
	@echo ""
	@echo "  https://$(or $(SITE_ADDRESS),localhost)/   (/visualizer/, /api/)"
	@echo "  https://$(or $(PLAY_SITE_ADDRESS),play.$(or $(SITE_ADDRESS),localhost))/play/"

prod-down:
	$(PROD_COMPOSE) down

prod-logs:
	$(PROD_COMPOSE) logs -f

## ai-setup START
# Shared Claude Code sandbox: https://github.com/Veragin/ai-setup (managed by its init.md)
AI_SERVICE = story-template
AI_PROJECT = story
AI_SETUP_REPO ?= git@github.com:Veragin/ai-setup.git
include .ai/setup/ai-setup.mk
.ai/setup/ai-setup.mk:
	git clone $(AI_SETUP_REPO) .ai/setup
## ai-setup END
