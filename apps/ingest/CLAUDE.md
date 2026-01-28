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
- Samples whose `startAt` is older than the 90 day retention window or more than 24 hours ahead are skipped and counted, not rejected, so a 90 day backfill that straddles the edge still succeeds. Sleep sessions are never skipped.
- `samplebatch` returns every time as UTC truncated to microseconds, the precision Postgres stores. Compare and deduplicate only those values.
- `batchwriter` creates partitions before its transaction and writes both tables in one transaction. Duplicates inside a batch are collapsed in Go (last wins) after microsecond truncation, because one upsert statement cannot touch a row twice. A resend matches `IS DISTINCT FROM` on nothing and rewrites no row.
- A sample whose start time changes on the device keeps its external uuid but lands as a second row, since `start_at` is part of the key. Deletions on the device are not propagated. Both are open until the mobile sync (sub-project 3) defines deletes.

Callers: `apps/mobile` over HTTP (sub-project 3), CI.
