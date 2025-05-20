# packages/db

Owns: the Drizzle mirror of tables created by `db/migrations`, and the Pool backed client TS services use.

Must not know about: HTTP, Clerk, BullMQ, or any service's queries. Never generates or runs migrations; there is no drizzle-kit here.

Entry points: `@wearwise/db` (tables, `createDatabase`, `Database`), `@wearwise/db/testing` (test database URL).

Invariants and gotchas:
- A table exists here only after its SQL migration exists. Change the SQL first, then mirror it, then run the drift test.
- The drift test compares columns, SQL types, nullability, presence of a default and unique constraints against `wearwise_test`. It does not compare default values, foreign keys or constraint names, and only covers tables listed in `mirroredTables`. Add every new mirrored table there.
- Tests need `pnpm db:test:up` first (root script). CI does this before `pnpm test`.
- Tables Go owns (health data) are mirrored read only by convention; TS code must not write them.
- Close a client with `database.$client.end()`.

Callers: `apps/api`. Later `apps/worker`.
