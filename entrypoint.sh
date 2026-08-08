#!/bin/sh
set -eu

# Prefer a separate Coolify migration job. This remains safe for rolling deploys:
# the runner serializes contenders with a PostgreSQL advisory lock.
echo "Running versioned database migrations..."
pnpm --filter @workspace/db run migrate

# Do not expose the schema-owner credential to the long-running Node process.
unset MIGRATION_DATABASE_URL

echo "Starting server..."
exec node --enable-source-maps artifacts/api-server/dist/index.mjs
