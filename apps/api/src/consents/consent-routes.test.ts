import { randomUUID } from "node:crypto";
import { consents, createDatabase, users } from "@wearwise/db";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { buildApp } from "../app.ts";
import { createSessionTokenSigner } from "../test-support/session-tokens.ts";
import { createTestConfig } from "../test-support/test-config.ts";

const signer = await createSessionTokenSigner();
const config = createTestConfig({ clerkJwtKey: signer.jwtKey });
const database = createDatabase(config.databaseUrl);
let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp({ config, database, logger: false });
});
afterAll(async () => {
  await app.close();
  await database.$client.end();
});

const postConsent = async (token: string, body: unknown) =>
  app.inject({
    method: "POST",
    url: "/v1/consents",
    headers: { authorization: `Bearer ${token}` },
    payload: body as object,
  });

describe("POST /v1/consents", () => {
  test("records a consent that GET /v1/me then lists", async () => {
    const token = await signer.signSessionToken(`user_${randomUUID()}`);
    expect(
      (
        await postConsent(token, {
          kind: "health_data_processing",
          version: "2026-09-23",
        })
      ).statusCode,
    ).toBe(204);
    const me = await app.inject({
      method: "GET",
      url: "/v1/me",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(me.json().consents).toEqual([
      {
        kind: "health_data_processing",
        version: "2026-09-23",
        acceptedAt: expect.any(String),
      },
    ]);
  });

  test("keeps one row when the same consent is sent twice", async () => {
    const clerkUserId = `user_${randomUUID()}`;
    const token = await signer.signSessionToken(clerkUserId);
    await postConsent(token, { kind: "privacy_notice", version: "1" });
    expect(
      (await postConsent(token, { kind: "privacy_notice", version: "1" }))
        .statusCode,
    ).toBe(204);
    const rows = await database
      .select()
      .from(consents)
      .innerJoin(users, eq(users.id, consents.userId))
      .where(eq(users.clerkUserId, clerkUserId));
    expect(rows).toHaveLength(1);
  });

  test("keeps both rows when the version changes", async () => {
    const token = await signer.signSessionToken(`user_${randomUUID()}`);
    await postConsent(token, { kind: "privacy_notice", version: "1" });
    await postConsent(token, { kind: "privacy_notice", version: "2" });
    const me = await app.inject({
      method: "GET",
      url: "/v1/me",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(
      me.json().consents.map((consent: { version: string }) => consent.version),
    ).toEqual(["1", "2"]);
  });

  test("rejects an unknown kind", async () => {
    const token = await signer.signSessionToken(`user_${randomUUID()}`);
    expect(
      (await postConsent(token, { kind: "marketing", version: "1" }))
        .statusCode,
    ).toBe(400);
  });
});
