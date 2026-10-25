#!/bin/sh
# Entrypoint of the production `app` image (docker/docker-compose.prod.yml), then runs the service's command.
#
# STORY_DB_SETUP=1 (the server service only: it owns the database): `stories:import-files`, which applies
# the database migrations, moves every legacy `story.json` of the `stories` volume into the
# database, rewrites stale story tsconfigs and seeds the example and demo stories: their folders are copied
# from the image when the database holds no story yet, and their rows come from `server/seed/<id>.story.json`.
set -e
root="${STORIES_ROOT:-/app/stories}"
mkdir -p "$root"
if [ "${STORY_DB_SETUP:-}" = 1 ]; then
    echo "[prod-entrypoint] applying database migrations, importing story.json files from $root"
    (cd /app/server && yarn stories:import-files --seed /app/.seed/example --seed /app/.seed/demo)
fi
exec "$@"
