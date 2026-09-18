# apps/ingest

Owns: the Go ingest service: verifying Clerk session tokens, validating health sample batches from the mobile app, storing them in `health_samples` and `sleep_sessions`, and dropping raw sample partitions past the retention window.

Must not know about: BullMQ, OpenRouter, the Fastify API's routes, or how the mobile app reads HealthKit or Health Connect. It never writes `users` or `consents`.

Entry points: `cmd/ingest` (process; `ingest healthcheck` probes a running server for the container healthcheck), `internal/ingesthttp` (`GET /healthz`, `POST /v1/samples`), `internal/config` (settings). Environment: `DATABASE_URL`, `PORT` (default 8080), `CLERK_JWT_KEY` (the same PEM the API uses).

Invariants and gotchas:
- Production settings come only through `internal/config`, which takes `os.Getenv` from `cmd/ingest` as an argument so tests pass a map. The one other environment read is `TEST_DATABASE_URL` in `internal/testdatabase`, used only by tests.
- `internal/metriccatalog/units.gen.go` is generated from `@wearwise/metrics-catalog` by `pnpm --filter @wearwise/ingest generate` and committed. CI regenerates it and fails on any diff.
- `CLERK_JWT_KEY` must be a PKIX `PUBLIC KEY` PEM with real newlines. Verification is offline; there is no JWKS fetch. clerk-sdk-go accepts tokens without `exp` and tokens of pending sessions, so `sessiontoken` rejects both itself. `azp` is not checked, because native app tokens carry none.
- `internal/store` holds sqlc output generated from `queries/` and `db/migrations`. Change those and run `pnpm --filter @wearwise/ingest sqlc` (Docker); never edit the generated `.go` files. The `_test.go` files there are hand written and test the SQL functions. CI regenerates and fails on any diff.
- Tests run against the migrated `wearwise_test` (`pnpm db:test:up`, `TEST_DATABASE_URL`) and create their own users through `internal/testdatabase`, never truncating.
- Samples whose `startAt` is older than the 90 day retention window or more than 24 hours ahead are skipped and counted, not rejected, so a 90 day backfill that straddles the edge still succeeds. Sleep sessions are never skipped, but a session with a stage whose start or end falls outside years 0 to 9999 in UTC is rejected with a 400, because stages are stored as JSON and encoding/json cannot write those years.
- `samplebatch` returns every time as UTC truncated to microseconds, the precision Postgres stores. Compare and deduplicate only those values.
- `batchwriter` creates partitions before its transaction and writes both tables in one transaction. Duplicates inside a batch are collapsed in Go (last wins) after microsecond truncation, because one upsert statement cannot touch a row twice. A resend matches `IS DISTINCT FROM` on nothing and rewrites no row.
- A sample whose start time changes on the device keeps its external uuid but lands as a second row, since `start_at` is part of the key. Deletions on the device are not propagated. Both are open until the mobile sync (sub-project 3) defines deletes.
- `POST /v1/samples` checks the token, then the `health_data_processing` consent, then reads the body. A signed in user with no `users` row gets 403, so the mobile app must call the API's `/v1/me` (which creates the row) and record consent before its first sync.
- The 8 MiB body cap applies to both the raw and the gzip decoded body.
- A 500 never carries error details; they go to the log.
- A partition is dropped only when its whole month ends before now minus 90 days, and the loop runs daily, so raw samples live 90 to about 121 days. A batch writing into a month the loop is dropping at that moment can fail with a 500 and is retried by the app.
- `BenchmarkPostSamples` is the throughput baseline: `go -C apps/ingest test -run '^$' -bench . -benchtime=20x ./internal/ingesthttp`. It needs the migrated `wearwise_test` and runs in process, so it excludes network time. Rerun it and compare before claiming ingest got faster.

Callers: `apps/mobile` over HTTP (sub-project 3), CI.
