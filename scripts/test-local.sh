#!/bin/sh
set -eu

compose_file="compose.test.yml"
database_url="postgres://kindred:kindred@127.0.0.1:5433/kindred_test"

if [ -S "$HOME/.docker/desktop/docker.sock" ]; then
  export DOCKER_HOST="unix://$HOME/.docker/desktop/docker.sock"
elif [ -S "/home/griffixchips/.docker/desktop/docker.sock" ]; then
  export DOCKER_HOST="unix:///home/griffixchips/.docker/desktop/docker.sock"
fi

cleanup() {
  docker compose -f "$compose_file" down --volumes --remove-orphans
}

trap cleanup EXIT INT TERM

docker compose -f "$compose_file" up --detach --wait

export DATABASE_URL="$database_url"
export NODE_ENV="test"
export HELCIM_PAYMENTS_ENABLED="false"

pnpm --filter @workspace/db run push
pnpm --filter @workspace/api-server test
