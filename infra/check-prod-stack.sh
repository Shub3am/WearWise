#!/usr/bin/env bash
# Why: proves the production compose file builds, migrates and serves a healthy API and ingest service before Coolify ever runs it.
# Must not: touch the dev stack or leave anything behind; it uses its own project name and deletes its volumes.
set -euo pipefail
cd "$(dirname "$0")/.."

export SERVICE_USER_POSTGRES=wearwise
SERVICE_PASSWORD_POSTGRES="$(openssl rand -hex 16)"
export SERVICE_PASSWORD_POSTGRES
CLERK_PUBLISHABLE_KEY="pk_test_$(printf 'example.clerk.accounts.dev$' | base64)"
export CLERK_PUBLISHABLE_KEY
export CLERK_SECRET_KEY=sk_test_prod_check
CLERK_JWT_KEY="$(node -e 'console.log(require("node:crypto").generateKeyPairSync("rsa",{modulusLength:2048,publicKeyEncoding:{type:"spki",format:"pem"}}).publicKey)')"
export CLERK_JWT_KEY
export CLERK_WEBHOOK_SIGNING_SECRET=whsec_prod_check

# Coolify runs compose with --project-directory set to the repo root, so build contexts are repo relative.
compose=(docker compose --project-name wearwise-prod-check --project-directory . -f infra/compose.prod.yml)
trap '"${compose[@]}" down --volumes --remove-orphans >/dev/null 2>&1' EXIT

"${compose[@]}" up --detach --build --wait
database_tables="$("${compose[@]}" exec -T postgres psql -U wearwise -d wearwise -tAc "select to_regclass('public.users'), to_regclass('public.health_samples')")"
[ "$database_tables" = "users|health_samples" ] || { echo "tables missing after migrate: $database_tables" >&2; exit 1; }
# up --wait only waits for services that exist, so a missing ingest service would pass silently.
ingest_health="$("${compose[@]}" ps --format '{{.Health}}' ingest)"
[ "$ingest_health" = "healthy" ] || { echo "ingest not healthy: ${ingest_health:-no such service}" >&2; exit 1; }
echo "prod stack ok: migrations applied, api and ingest healthy"
