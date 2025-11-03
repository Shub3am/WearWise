import { createDatabase } from "@wearwise/db";
import { afterAll, expect, test } from "vitest";
import { buildApp } from "./app.ts";
import { createSessionTokenSigner } from "./test-support/session-tokens.ts";
import {
  createTestConfig,
  unreachableDatabaseUrl,
} from "./test-support/test-config.ts";

const unreachableDatabase = createDatabase(unreachableDatabaseUrl);
afterAll(async () => {
  await unreachableDatabase.$client.end();
});

test("an unexpected failure answers 500 without describing it", async () => {
  const signer = await createSessionTokenSigner();
  const app = await buildApp({
    config: createTestConfig({ clerkJwtKey: signer.jwtKey }),
    database: unreachableDatabase,
    logger: false,
  });
  const response = await app.inject({
    method: "GET",
    url: "/v1/me",
    headers: {
      authorization: `Bearer ${await signer.signSessionToken("user_unreachable")}`,
    },
  });
  expect(response.statusCode).toBe(500);
  expect(response.json()).toEqual({ error: "Internal Server Error" });
  await app.close();
});
