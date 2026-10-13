#!/bin/sh
# Entrypoint of the production `app` image (docker/docker-compose.prod.yml), then runs the service's command.
#
# STORY_DB_SETUP=1 (the server service only: it owns the database): apply the database migrations, then
# `stories:import-files`, which moves every legacy `story.json` of the `stories` volume into the
# database, rewrites stale story tsconfigs and seeds the example story: its folder is copied from the
# image when the database holds no story yet, and its row comes from `server/seed/example.story.json`.
# The engine service only reads the volume.
set -e
root="${STORIES_ROOT:-/app/stories}"
seed=/app/.seed/example
mkdir -p "$root"
if [ "${STORY_DB_SETUP:-}" = 1 ]; then
    echo "[prod-entrypoint] applying database migrations"
    (cd /app/server && yarn migration:run)
    echo "[prod-entrypoint] importing story.json files from $root"
    (cd /app/server && yarn stories:import-files --seed "$seed")
fi
exec "$@"
