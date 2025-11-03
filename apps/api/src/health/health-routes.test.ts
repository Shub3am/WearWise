import { createDatabase } from "@wearwise/db";
import { afterAll, describe, expect, test } from "vitest";
import { buildApp } from "../app.ts";
import {
  createTestConfig,
  unreachableDatabaseUrl,
} from "../test-support/test-config.ts";

describe("GET /healthz", () => {
  const config = createTestConfig();
  const database = createDatabase(config.databaseUrl);
  const unreachableDatabase = createDatabase(unreachableDatabaseUrl);
  afterAll(async () => {
    await database.$client.end();
    await unreachableDatabase.$client.end();
  });

  test("returns ok when Postgres answers", async () => {
    const app = await buildApp({ config, database, logger: false });
    const response = await app.inject({ method: "GET", url: "/healthz" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
    await app.close();
  });

  test("returns 503 when Postgres is unreachable", async () => {
    const app = await buildApp({
      config,
      database: unreachableDatabase,
      logger: false,
    });
    const response = await app.inject({ method: "GET", url: "/healthz" });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ status: "unavailable" });
    await app.close();
  });
});
