# WearWise

Consumer wellness coach: syncs Apple Health and Health Connect data, scores sleep, recovery and activity, and coaches with AI grounded in the user's own metrics. Not a diagnostic tool.

## Modules

- `packages/metrics-catalog/`: the health metrics WearWise understands. See its CLAUDE.md.
- `packages/db/`: Drizzle mirror of the SQL schema plus the Postgres client for TS services. See its CLAUDE.md.
- `packages/contracts/`: zod request and response schemas shared by API and clients. See its CLAUDE.md.
- `apps/api/`: Fastify product API with Clerk auth. See its CLAUDE.md.
- `apps/ingest/`: Go service that verifies Clerk session tokens and stores health sample batches. See its CLAUDE.md.
- `apps/mobile/`: Expo app that signs in, records consent and syncs HealthKit and Health Connect data to ingest. See its CLAUDE.md.
- `db/`: dbmate SQL migrations, single owner of the schema. See its CLAUDE.md.
- `infra/`: local dev stack, production compose that Coolify deploys, and their check scripts. See its CLAUDE.md.
- `legacy/`: imported Code for Bharat prototype history (Flask backend, Next.js frontend). Read only, never edit, removed at v1.

## Run

- `pnpm install` (also needs Go 1.27.1 for apps/ingest)
- `docker compose -f infra/docker-compose.dev.yml up -d --wait`
- `cp .env.example .env` then `pnpm db:up`
- API: `node --env-file=.env apps/api/src/server.ts` (needs the Clerk variables listed in apps/api/CLAUDE.md)
- Ingest: `go -C apps/ingest run ./cmd/ingest` with `DATABASE_URL` and `CLERK_JWT_KEY` exported (see apps/ingest/CLAUDE.md)
- Mobile: `cp apps/mobile/.env.example apps/mobile/.env`, then `pnpm --filter @wearwise/mobile android`

## Test

- `pnpm db:test:up` once before `pnpm test` (migrates `wearwise_test`)
- `pnpm lint && pnpm typecheck && pnpm test`
- `./infra/check-dev-stack.sh` for the database and Redis setup
- `./infra/check-prod-stack.sh` builds and runs the production stack

## Deploy

- CI deploys on green pushes to `main` by calling Coolify's deploy API; it skips until the COOLIFY_URL, COOLIFY_TOKEN and COOLIFY_APP_UUID secrets exist.

## Repo wide rules

- Commits here use the identity `shub3am <shubhamvishwakarma0604@gmail.com>`, set in local git config.
- New work goes on branch `main`, one logical change per commit, no co-author trailers.
- The schema changes only through `db/migrations`. Never run drizzle-kit migrations.
- Local ports: Postgres 55432, Redis 56379.
- Internal TS packages are consumed as source (`.ts` imports, `noEmit`); no build step for them.
