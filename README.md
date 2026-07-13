# WearWise

WearWise is a wellness coach for consumers. It syncs Apple Health and Health Connect data, scores sleep, recovery and activity, and coaches with AI grounded in the user's own metrics. It is not a medical or diagnostic tool.

It started as a Code for Bharat prototype. The original backend and frontend histories are kept under `legacy/`.

## Status

Work in progress on branch `rebuild`. What runs today:

| Part | Folder | State |
|------|--------|-------|
| Product API (Fastify, Clerk auth) | `apps/api` | Working: profile, consents, Clerk webhook, health check |
| Ingest service (Go) | `apps/ingest` | Working: verifies Clerk tokens, stores health sample batches |
| Database schema (dbmate) | `db/migrations` | Working |
| Shared schemas, metric catalog, DB client | `packages/*` | Working |
| Mobile app (Expo) | `apps/mobile` | Planned |
| Metrics engine, coach, reports, billing, web | | Planned |

## Requirements

- Node 24 or newer (`.nvmrc` pins 24)
- pnpm 12.5.1 (`corepack enable` picks it up from `package.json`)
- Go 1.27.1, for `apps/ingest`
- Docker, for Postgres and Redis

## Setup

```bash
pnpm install
docker compose -f infra/docker-compose.dev.yml up -d --wait
cp .env.example .env
pnpm db:up
```

This starts Postgres (pgvector) on port 55432 and Redis on port 56379, then applies the migrations to the `wearwise` database. The ports are not the defaults so they do not clash with other local databases.

## Run the API

Add the Clerk values to `.env` first:

```bash
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_JWT_KEY="-----BEGIN PUBLIC KEY-----
...
-----END PUBLIC KEY-----"
CLERK_WEBHOOK_SIGNING_SECRET=whsec_...
```

`CLERK_JWT_KEY` is your Clerk instance's JWT public key in PEM form, from the Clerk dashboard. Keep its real line breaks; an escaped `\n` is rejected.

Then start it:

```bash
pnpm --filter @wearwise/api dev
```

It listens on `http://localhost:3000` (change it with `PORT` and `HOST`).

| Method | Path | Auth | What it does |
|--------|------|------|--------------|
| GET | `/healthz` | none | Database check |
| GET | `/v1/me` | Clerk session token | The signed in user's profile and consents; creates the user on first call |
| PATCH | `/v1/me` | Clerk session token | Update the user's time zone, body `{"timezone":"Asia/Kolkata"}` |
| POST | `/v1/consents` | Clerk session token | Record a consent, body `{"kind":"health_data_processing","version":"2026-09-24"}` |
| POST | `/webhooks/clerk` | Clerk webhook signature | Creates and deletes users from Clerk events |

Send the session token as `Authorization: Bearer <token>`. Consent kinds are `privacy_notice` and `health_data_processing`.

## Run the ingest service

```bash
set -a; source .env; set +a
go -C apps/ingest run ./cmd/ingest
```

It listens on port 8080 (change it with `PORT`) and reads `DATABASE_URL` and `CLERK_JWT_KEY`.

| Method | Path | What it does |
|--------|------|--------------|
| GET | `/healthz` | Database check |
| POST | `/v1/samples` | Store a batch of health samples and sleep sessions |

A user can post samples only after calling the API's `GET /v1/me` once and recording the `health_data_processing` consent; until then ingest answers 403. Bodies may be gzip encoded (`Content-Encoding: gzip`) and are capped at 8 MiB. Resending a batch is safe: samples are keyed on their device id, so nothing is stored twice.

## Test

```bash
pnpm db:test:up
pnpm lint && pnpm typecheck && pnpm test
```

`pnpm db:test:up` migrates the separate `wearwise_test` database; run it once, and again after adding a migration. `pnpm test` runs the TypeScript tests (Vitest) and the Go tests through Turborepo.

Other checks:

- `./infra/check-dev-stack.sh`: the database and Redis setup, including a migration up, rollback, up round trip
- `./infra/check-prod-stack.sh`: builds and runs the production compose stack locally
- `go -C apps/ingest test -run '^$' -bench . -benchtime=20x ./internal/ingesthttp`: ingest throughput benchmark

## Database migrations

The schema changes only through SQL files in `db/migrations`, run by dbmate.

```bash
pnpm db:up         # apply pending migrations
pnpm db:rollback   # undo the last one
```

`packages/db` mirrors the schema in Drizzle for TypeScript. Never generate or run migrations with drizzle-kit.

## Deploy

GitHub Actions (`.github/workflows/ci.yml`) runs lint, typecheck and tests on every push. A green push to `rebuild` then triggers a deploy of `infra/compose.prod.yml` through Coolify's API, once the `COOLIFY_URL`, `COOLIFY_TOKEN` and `COOLIFY_APP_UUID` secrets are set. Until then the deploy step is skipped. The Coolify setup checklist is in `infra/CLAUDE.md`.

## Repository layout

```
apps/api               Fastify product API
apps/ingest            Go ingest service
packages/contracts     request and response schemas shared by the API and its clients
packages/db            Drizzle schema mirror and Postgres client
packages/metrics-catalog  the health metrics WearWise understands
db/migrations          dbmate SQL migrations
infra                  local dev stack and production compose
legacy                 the original Code for Bharat prototype, read only
```

Each module has a `CLAUDE.md` with what it owns, its entry points and its gotchas.
