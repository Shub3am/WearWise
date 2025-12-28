# apps/ingest

Owns: the Go ingest service: verifying Clerk session tokens, validating health sample batches from the mobile app, storing them in `health_samples` and `sleep_sessions`, and dropping raw sample partitions past the retention window.

Must not know about: BullMQ, OpenRouter, the Fastify API's routes, or how the mobile app reads HealthKit or Health Connect. It never writes `users` or `consents`.

Entry points: `internal/config` (settings). Environment: `DATABASE_URL`, `PORT` (default 8080), `CLERK_JWT_KEY`.

Invariants and gotchas:
- `internal/config` is the only reader of the environment; it takes `os.Getenv` as an argument so tests pass a map.
- `internal/metriccatalog/units.gen.go` is generated from `@wearwise/metrics-catalog` by `pnpm --filter @wearwise/ingest generate` and committed. CI regenerates it and fails on any diff.
- `CLERK_JWT_KEY` must be a PKIX `PUBLIC KEY` PEM with real newlines. Verification is offline; there is no JWKS fetch. clerk-sdk-go accepts tokens without `exp` and tokens of pending sessions, so `sessiontoken` rejects both itself. `azp` is not checked, because native app tokens carry none.
- `internal/store` holds sqlc output generated from `queries/` and `db/migrations`. Change those and run `pnpm --filter @wearwise/ingest sqlc` (Docker); never edit the generated `.go` files. The `_test.go` files there are hand written and test the SQL functions. CI regenerates and fails on any diff.
- Tests run against the migrated `wearwise_test` (`pnpm db:test:up`, `TEST_DATABASE_URL`) and create their own users through `internal/testdatabase`, never truncating.

Callers: `apps/mobile` over HTTP (sub-project 3), CI.
