# db

Owns: the database schema, as plain SQL dbmate migrations in `db/migrations`.

Must not know about: ORMs. Drizzle (TS) and sqlc (Go) read this schema; neither generates or runs migrations.

Entry points: `pnpm db:up`, `pnpm db:rollback` (use `DATABASE_URL` from the environment or `.env`).

Invariants and gotchas:
- This folder is the single owner of the schema. Go and Node both depend on it.
- File names are `NNNN_description.sql`, 4 digit sequence, never renumbered after merge.
- Every migration has a working `-- migrate:down`; CI runs up, rollback, up.
- `users.clerk_user_id` is the join key to Clerk and is unique.
- Deleting a `users` row cascades to `consents`. Every later per user table must also declare `ON DELETE CASCADE`.
- Schema dumps are off (`--no-dump-schema`) because local pg_dump does not match Postgres 18.
- `db/Dockerfile` bakes the migrations into a dbmate image; it is the `migrate` service in production.
- `health_samples` is range partitioned by UTC month on `start_at`. Partitions are created at runtime by `ensure_health_samples_partition` and dropped by `drop_health_samples_partitions_before`; no migration creates monthly partitions. Its primary key includes `start_at` because a partitioned table's unique keys must contain the partition key.
- Only apps/ingest writes `health_samples` and `sleep_sessions`.
- `health_samples` partitions before 2002 belong to the drop tests in `apps/ingest/internal/store`; never create them anywhere else.
- DDL that locks both `users` and `health_samples` must lock `users` first, the order a cascading user delete takes them; the reverse order deadlocks against account deletion.
- Both partition functions set a 2 second `lock_timeout` after taking their advisory lock, so a long reader of `health_samples` (pg_dump) makes them fail with SQLSTATE 55P03 instead of queueing every ingest and `users` write behind their DDL. Callers treat that as a retryable error.

Callers: developers, CI, deploy pipeline (sub-project 1), apps/ingest (sqlc reads this schema to generate its store).
