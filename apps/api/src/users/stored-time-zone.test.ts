import { canonicalTimeZone } from "@wearwise/contracts";
import { createDatabase } from "@wearwise/db";
import { testDatabaseUrl } from "@wearwise/db/testing";
import { sql } from "drizzle-orm";
import { afterAll, expect, test } from "vitest";

const database = createDatabase(testDatabaseUrl);
afterAll(async () => {
  await database.$client.end();
});

test("every time zone the API accepts is one Postgres can load", async () => {
  const postgresZoneRows = await database.execute<{ name: string }>(
    sql`select name from pg_timezone_names`,
  );
  const postgresZones = new Set(postgresZoneRows.rows.map((row) => row.name));
  const acceptedZones = [...Intl.supportedValuesOf("timeZone"), "UTC"]
    .map(canonicalTimeZone)
    .filter((zone) => zone !== undefined);

  expect(acceptedZones.filter((zone) => !postgresZones.has(zone))).toEqual([]);
});
