#!/bin/sh
set -eu

# Database indexes are initialized by the API at startup. Post-merge must never
# mutate a database or receive migration credentials.
corepack pnpm@10.28.1 install --frozen-lockfile
