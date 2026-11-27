#!/bin/sh
# Installs the docker CLI (no daemon) from Docker's apt repository: the AI launcher talks to the host daemon
# through the mounted socket (Dockerfile.prod `launcher`, Dockerfile.dev `launcher`). Runs as root.
set -e
. /etc/os-release
install -m 0755 -d /etc/apt/keyrings
curl -fsSL "https://download.docker.com/linux/$ID/gpg" -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/$ID $VERSION_CODENAME stable" \
    > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y --no-install-recommends docker-ce-cli
rm -rf /var/lib/apt/lists/*
