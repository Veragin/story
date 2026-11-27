#!/bin/sh
# Entrypoint of the AI agent image (docker/Dockerfile.ai). HOME (/home/agent) is an empty tmpfs on every start,
# so the baked Claude Code config is copied into it first and `.claude/projects` is linked to `/sessions`, the
# sessions volume mounted by the launcher (the transcripts `--resume` reads). Then runs claude with the
# launcher's arguments.
set -e
mkdir -p "$HOME/.claude"
for entry in /opt/agent/claude/* /opt/agent/claude/.[!.]*; do
    [ -e "$entry" ] || continue
    [ "$(basename "$entry")" = projects ] && continue
    cp -R "$entry" "$HOME/.claude/"
done
ln -sfn /sessions "$HOME/.claude/projects"
exec claude "$@"
