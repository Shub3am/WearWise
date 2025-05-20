// Why: one place that names the database every DB backed test runs against.
// Must not: create, migrate or clean the database; `pnpm db:test:up` migrates it.
export const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  "postgres://wearwise:wearwise@localhost:55432/wearwise_test?sslmode=disable";
