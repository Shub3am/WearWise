# db

Owns: the database schema, as plain SQL dbmate migrations in `db/migrations`.

Must not know about: ORMs. Drizzle (TS) and sqlc (Go) read this schema; neither generates or runs migrations.

Entry points: `pnpm db:up`, `pnpm db:rollback` (use `DATABASE_URL` from the environment or `.env`).

Invariants and gotchas:
- This folder is the single owner of the schema. Go and Node both depend on it.
- File names are `NNNN_description.sql`, 4 digit sequence, never renumbered after merge.
- Every migration has a working `-- migrate:down`; CI runs up, rollback, up.
- Schema dumps are off (`--no-dump-schema`) because local pg_dump does not match Postgres 18.

Callers: developers, CI, deploy pipeline (sub-project 1).
