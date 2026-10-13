#!/bin/sh
# Entrypoint of the production `app` image (docker/docker-compose.prod.yml), then runs the service's command.
#
# STORY_DB_SETUP=1 (the new server, `server/`, from the cut-over on): apply the database migrations, then
# `stories:import-files`, which moves every `story.json` into the database, rewrites stale story
# tsconfigs and, when the database holds no story yet, copies in the example story from the seed and
# imports it. Only the server service may set it: it migrates the database.
#
# Otherwise (the old Visualizer server, which still reads `story.json`): seed the `stories` volume with
# the example story when it holds no story yet (a fresh volume, or every story deleted). Docker also
# copies the image's `stories/` into a *new* named volume, so this matters mostly for a volume that
# was created empty or emptied later.
set -e
root="${STORIES_ROOT:-/app/stories}"
seed=/app/.seed/example
mkdir -p "$root"
if [ "${STORY_DB_SETUP:-}" = 1 ]; then
    echo "[prod-entrypoint] applying database migrations"
    (cd /app/server && yarn migration:run)
    echo "[prod-entrypoint] importing story.json files from $root"
    (cd /app/server && yarn stories:import-files --seed "$seed")
elif [ -z "$(find "$root" -mindepth 2 -maxdepth 2 -name story.json -print -quit)" ] && [ ! -e "$root/example" ]; then
    echo "[prod-entrypoint] no story in $root: seeding the example story"
    cp -a "$seed" "$root/example"
fi
exec "$@"
