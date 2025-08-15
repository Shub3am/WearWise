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

const getMe = async (token?: string) =>
  app.inject({
    method: "GET",
    url: "/v1/me",
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });

describe("GET /v1/me", () => {
  test("rejects a request without a token", async () => {
    expect((await getMe()).statusCode).toBe(401);
  });

  test("rejects a token signed by another key", async () => {
    const otherSigner = await createSessionTokenSigner();
    expect(
      (await getMe(await otherSigner.signSessionToken("user_forged")))
        .statusCode,
    ).toBe(401);
  });

  test("rejects an expired token", async () => {
    const expiredToken = await signer.signSessionToken(
      "user_expired",
      Math.floor(Date.now() / 1000) - 600,
    );
    expect((await getMe(expiredToken)).statusCode).toBe(401);
  });

  test("creates the user on first request with UTC and no consents", async () => {
    const clerkUserId = `user_${randomUUID()}`;
    const response = await getMe(await signer.signSessionToken(clerkUserId));
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ timezone: "UTC", consents: [] });
    const rows = await database
      .select()
      .from(users)
      .where(eq(users.clerkUserId, clerkUserId));
    expect(rows).toHaveLength(1);
    expect(response.json().id).toBe(rows[0]?.id);
  });

  test("returns the same user on later requests", async () => {
    const token = await signer.signSessionToken(`user_${randomUUID()}`);
    const first = (await getMe(token)).json();
    const second = (await getMe(token)).json();
    expect(second.id).toBe(first.id);
  });

  test("creates exactly one row when first requests race", async () => {
    const clerkUserId = `user_${randomUUID()}`;
    const token = await signer.signSessionToken(clerkUserId);
    const responses = await Promise.all([
      getMe(token),
      getMe(token),
      getMe(token),
    ]);
    expect(responses.map((response) => response.statusCode)).toEqual([
      200, 200, 200,
    ]);
    expect(new Set(responses.map((response) => response.json().id)).size).toBe(
      1,
    );
    const rows = await database
      .select()
      .from(users)
      .where(eq(users.clerkUserId, clerkUserId));
    expect(rows).toHaveLength(1);
  });

  test("lists the user's consents", async () => {
    const token = await signer.signSessionToken(`user_${randomUUID()}`);
    const { id } = (await getMe(token)).json();
    await database
      .insert(consents)
      .values({ userId: id, kind: "privacy_notice", version: "2026-09-23" });
    expect((await getMe(token)).json().consents).toEqual([
      {
        kind: "privacy_notice",
        version: "2026-09-23",
        acceptedAt: expect.any(String),
      },
    ]);
  });
});
