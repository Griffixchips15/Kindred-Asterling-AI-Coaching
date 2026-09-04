#!/bin/sh
set -eu

export NODE_ENV="test"
export HELCIM_PAYMENTS_ENABLED="false"

pnpm --filter @workspace/db run test:api
