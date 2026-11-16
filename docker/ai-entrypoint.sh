#!/bin/sh
# Entrypoint of the AI agent image (docker/Dockerfile.ai). HOME (/home/agent) is an empty tmpfs on every start,
# so the baked Claude Code config is copied into it first. `.claude/projects` is the sessions volume (the
# transcripts `--resume` reads), mounted by the launcher: it is left alone. Then runs claude with the
# launcher's arguments.
set -e
mkdir -p "$HOME/.claude"
for entry in /opt/agent/claude/* /opt/agent/claude/.[!.]*; do
    [ -e "$entry" ] || continue
    [ "$(basename "$entry")" = projects ] && continue
    cp -R "$entry" "$HOME/.claude/"
done
exec claude "$@"
