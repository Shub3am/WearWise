#!/usr/bin/env bash
# Why: proves the local stack matches what production needs (pgvector installable,
# migrations reversible, Redis never evicts BullMQ keys).
# Must not: create application data or run anything against a non local database.
set -euo pipefail
cd "$(dirname "$0")/.."

compose="docker compose -f infra/docker-compose.dev.yml"
export DATABASE_URL="postgres://wearwise:wearwise@localhost:55432/wearwise?sslmode=disable"

pnpm db:up
pnpm db:rollback
pnpm db:up

vector_version=$($compose exec -T postgres psql -U wearwise -d wearwise -tAc \
  "select extversion from pg_extension where extname = 'vector'")
test -n "$vector_version" || { echo "pgvector missing"; exit 1; }

eviction_policy=$($compose exec -T redis redis-cli config get maxmemory-policy | tail -1)
test "$eviction_policy" = "noeviction" || { echo "redis policy is $eviction_policy"; exit 1; }

echo "dev stack ok: pgvector $vector_version, redis $eviction_policy"
