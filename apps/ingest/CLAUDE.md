# apps/ingest

Owns: the Go ingest service: verifying Clerk session tokens, validating health sample batches from the mobile app, storing them in `health_samples` and `sleep_sessions`, and dropping raw sample partitions past the retention window.

Must not know about: BullMQ, OpenRouter, the Fastify API's routes, or how the mobile app reads HealthKit or Health Connect. It never writes `users` or `consents`.

Entry points: `internal/config` (settings). Environment: `DATABASE_URL`, `PORT` (default 8080), `CLERK_JWT_KEY`.

Invariants and gotchas:
- `internal/config` is the only reader of the environment; it takes `os.Getenv` as an argument so tests pass a map.

Callers: `apps/mobile` over HTTP (sub-project 3), CI.
