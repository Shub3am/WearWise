// Why: the one way TypeScript services open a Postgres connection pool with the Drizzle mirror attached.
// Must not: run migrations or hold queries; callers own their queries.
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.ts";

export type Database = NodePgDatabase<typeof schema> & { $client: Pool };

export function createDatabase(connectionString: string): Database {
  return drizzle({ client: new Pool({ connectionString }), schema });
}
