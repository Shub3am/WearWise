// Why: public surface of @wearwise/db.
// Must not: export test helpers; those live behind @wearwise/db/testing.
export { createDatabase, type Database } from "./client.ts";
export { consents, users } from "./schema.ts";
