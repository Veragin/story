resume ?=
COMPOSE = docker compose

# Git author for commits made inside the container. Read from the host's git
# config unless already set in the environment.
GIT_USER_NAME ?= $(shell git config user.name)
GIT_USER_EMAIL ?= $(shell git config user.email)

define CLAUDE_CONFIG
{"includeCoAuthoredBy":false}
endef

define TS_CLAUDE_LSP
{"name":"village-lsp","version":"1.0.0","lspServers":{"typescript":{"command":"typescript-language-server","args":["--stdio"],"extensionToLanguage":{".ts":"typescript",".tsx":"typescriptreact",".js":"javascript",".jsx":"javascriptreact"}}}}
endef

AGENT_ENV_ARGS = \
	-e CLAUDE_CODE_OAUTH_TOKEN=$(CLAUDE_CODE_OAUTH_TOKEN) \
	-e CLAUDE_CODE_ENABLE_TELEMETRY=0 \
	-e AUTHOR_EMAIL=$(AUTHOR_EMAIL) \
	-e "GIT_USER_NAME=$(GIT_USER_NAME)" \
	-e "GIT_USER_EMAIL=$(GIT_USER_EMAIL)"

# Shared bootstrap: ensure local bins are on PATH and configure git author.
define GIT_SETUP
	export PATH="$$HOME/.local/bin:$$PATH" && \
	if [ -f "$$HOME/.gitconfig-host" ]; then git config --global include.path "$$HOME/.gitconfig-host"; fi && \
	if [ -n "$$GIT_USER_NAME" ]; then git config --global user.name "$$GIT_USER_NAME"; fi && \
	if [ -n "$$GIT_USER_EMAIL" ]; then git config --global user.email "$$GIT_USER_EMAIL"; fi && \
	if [ -z "$$GIT_USER_NAME" ] && [ -z "$$GIT_USER_EMAIL" ]; then \
		printf "\033[0;33mWarning: Could not determine git author. Set user.name/user.email in git config on your host.\033[0m\n"; \
	fi
endef

define CLAUDE_INIT
	mkdir -p $$HOME/.claude/lsp-plugin/.claude-plugin && \
	echo '"'"'$(CLAUDE_CONFIG)'"'"' > $$HOME/.claude/settings.json && \
	echo '"'"'$(TS_CLAUDE_LSP)'"'"' > $$HOME/.claude/lsp-plugin/.claude-plugin/plugin.json && \
	CJ="$$HOME/.claude.json"; [ -s "$$CJ" ] || echo "{}" > "$$CJ"; \
	if command -v jq >/dev/null 2>&1; then \
		VER=$$(claude --version 2>/dev/null | grep -oE "[0-9]+\.[0-9]+\.[0-9]+" | head -1); \
		jq --arg v "$$VER" --arg pwd "$$PWD" '"'"'. + {hasCompletedOnboarding:true,theme:"dark",bypassPermissionsModeAccepted:true} + (if $$v=="" then {} else {lastOnboardingVersion:$$v} end) | .projects[$$pwd] = ((.projects[$$pwd] // {}) + {hasTrustDialogAccepted:true,hasCompletedProjectOnboarding:true})'"'"' "$$CJ" > "$$CJ.tmp" && mv "$$CJ.tmp" "$$CJ"; \
	else \
		echo '"'"'{"hasCompletedOnboarding":true,"theme":"dark","bypassPermissionsModeAccepted":true,"projects":{"/app":{"hasTrustDialogAccepted":true,"hasCompletedProjectOnboarding":true}}}'"'"' > "$$CJ"; \
	fi && \
	$(GIT_SETUP) && \
	$(if $(COPILOT_VERSION),claude --version,claude --model opus --dangerously-skip-permissions --plugin-dir $$HOME/.claude/lsp-plugin$(if $(resume), --continue))
endef

define LAUNCH_CLAUDE
	@$(COMPOSE) exec $(AGENT_ENV_ARGS) $(1) bash -c '$(CLAUDE_INIT)'
endef

# One `docker compose exec` into the dev container, at /app. Every dev target below is
# this plus a yarn script, so they all share the container `make ai` is exec'd into.
# Split in two because `docker compose exec` only accepts flags *before* the service name,
# so `-d` cannot be appended to a variable that already ends in one.
DEV_EXEC_FLAGS = -w /app
DEV_EXEC = $(COMPOSE) exec $(DEV_EXEC_FLAGS) story-template
DEV_EXEC_DETACHED = $(COMPOSE) exec -d $(DEV_EXEC_FLAGS) story-template

# Where `make start` parks the output of the detached `yarn dev`. The dev servers are not
# PID 1 (see the note in docker-compose.yml), so `docker compose logs` cannot show them.
# `/app` is the bind mount, so this file is also readable straight from the host.
DEV_LOG = .dev.log

.PHONY: start up stop bash destroy ai build dev dev-engine dev-visualizer dev-visualizer-server dev-multi-engine logs

# The Phase 11 gate: brings up every service (8100 SingleEngine, 8101 Visualizer client,
# 8102 MultiEngine client, 8124 MultiEngine server). The container itself stays idle at
# PID 1 and `yarn dev` runs as a detached exec inside it, so a dev server that dies cannot
# take `make ai` / `make bash` down with it.
start: stop
	$(COMPOSE) up -d --build --remove-orphans
	$(DEV_EXEC_DETACHED) bash -c 'yarn dev > $(DEV_LOG) 2>&1'
	@echo ""
	@echo "  SingleEngine        http://localhost:8100"
	@echo "  Visualizer client   http://localhost:8101"
	@echo "  MultiEngine client  http://localhost:8102"
	@echo "  MultiEngine server  http://localhost:8124  (scaffold — every route answers 501)"
	@echo ""
	@echo "  logs: make logs     one service instead: make up, then make dev-engine"

# The container without the services. Use this when you want a single service — `make start`
# already holds all four ports, and vite is `strictPort`, so it would refuse rather than
# silently pick another one.
up:
	$(COMPOSE) up -d --build --remove-orphans

stop:
	$(COMPOSE) down

bash:
	$(COMPOSE) exec -w /app story-template bash

destroy:
	$(COMPOSE) down -v

ai:
	@echo "Starting claude for React..."
	$(call LAUNCH_CLAUDE,story-template)

logs:
	$(DEV_EXEC) tail -f $(DEV_LOG)

# Foreground equivalents of the above, for when you want the output attached and Ctrl-C to
# stop things. Run them against `make up` (not `make start`), or the ports are already taken.
dev:
	$(DEV_EXEC) yarn dev

dev-engine:
	$(DEV_EXEC) yarn dev:engine

dev-visualizer:
	$(DEV_EXEC) yarn dev:visualizer

# The Visualizer client proxies /api to this (VISUALIZER_PLAN §5.4), so running the client
# alone leaves every read and write failing — start both, or use `make dev`.
dev-visualizer-server:
	$(DEV_EXEC) yarn dev:visualizer-server

dev-multi-engine:
	$(DEV_EXEC) yarn dev:multi-engine
