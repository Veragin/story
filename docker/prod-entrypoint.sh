#!/bin/sh
# Entrypoint of the production `app` image (docker-compose.prod.yml): seed the `stories` volume with
# the example story when it holds no story yet (a fresh volume, or every story deleted), then run
# the service's command. Docker also copies the image's `stories/` into a *new* named volume, so
# this matters mostly for a volume that was created empty or emptied later.
set -e
root="${STORIES_ROOT:-/app/stories}"
mkdir -p "$root"
if [ -z "$(find "$root" -mindepth 2 -maxdepth 2 -name story.json -print -quit)" ] && [ ! -e "$root/example" ]; then
    echo "[prod-entrypoint] no story in $root: seeding the example story"
    cp -a /app/.seed/example "$root/example"
fi
exec "$@"
