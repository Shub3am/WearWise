# WearWise

Consumer wellness coach: syncs Apple Health and Health Connect data, scores sleep, recovery and activity, and coaches with AI grounded in the user's own metrics. Not a diagnostic tool.

## Modules

- `packages/metrics-catalog/`: the health metrics WearWise understands. See its CLAUDE.md.
- `db/`: dbmate SQL migrations, single owner of the schema. See its CLAUDE.md.
- `infra/`: local dev stack, later Dockerfiles and Coolify deploy. See its CLAUDE.md.
- `legacy/`: imported Code for Bharat prototype history (Flask backend, Next.js frontend). Read only, never edit, removed at v1.

## Run

- `pnpm install`
- `docker compose -f infra/docker-compose.dev.yml up -d --wait`
- `cp .env.example .env` then `pnpm db:up`

## Test

- `pnpm lint && pnpm typecheck && pnpm test`
- `./infra/check-dev-stack.sh` for the database and Redis setup

## Deploy

- Not set up yet. Planned: GitHub Actions calls the Coolify deploy webhook on green `main`.

## Repo wide rules

- Commits here use the identity `shub3am <shubhamvishwakarma0604@gmail.com>`, set in local git config.
- New work goes on branch `rebuild`, one logical change per commit, no co-author trailers.
- The schema changes only through `db/migrations`. Never run drizzle-kit migrations.
- Local ports: Postgres 55432, Redis 56379.
- Internal TS packages are consumed as source (`.ts` imports, `noEmit`); no build step for them.
