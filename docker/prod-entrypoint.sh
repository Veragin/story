#!/bin/sh
# Entrypoint of the production `app` image (docker/docker-compose.prod.yml), then runs the service's command.
#
# STORY_DB_SETUP=1 (the server service only: it owns the database): `stories:import-files`, which applies
# the database migrations, moves every legacy `story.json` of the `stories` volume into the
# database, rewrites stale story tsconfigs and seeds the example story: its folder is copied from the
# image when the database holds no story yet, and its row comes from `server/seed/example.story.json`.
set -e
root="${STORIES_ROOT:-/app/stories}"
seed=/app/.seed/example
mkdir -p "$root"
if [ "${STORY_DB_SETUP:-}" = 1 ]; then
    echo "[prod-entrypoint] applying database migrations, importing story.json files from $root"
    (cd /app/server && yarn stories:import-files --seed "$seed")
fi
exec "$@"
