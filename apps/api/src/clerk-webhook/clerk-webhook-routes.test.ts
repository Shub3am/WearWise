import { randomUUID } from "node:crypto";
import { consents, createDatabase, users } from "@wearwise/db";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { buildApp } from "../app.ts";
import { createTestConfig } from "../test-support/test-config.ts";
import { createWebhookSigner } from "../test-support/webhook-deliveries.ts";
import { ensureUser } from "../users/user-store.ts";

const webhookSigner = createWebhookSigner();
const config = createTestConfig({
  clerkWebhookSigningSecret: webhookSigner.signingSecret,
});
const database = createDatabase(config.databaseUrl);
let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp({ config, database, logger: false });
});
afterAll(async () => {
  await app.close();
  await database.$client.end();
});

const clerkEvent = (type: string, data: Record<string, unknown>) => ({
  data,
  event_attributes: {
    http_request: { client_ip: "0.0.0.0", user_agent: "test" },
  },
  instance_id: "ins_test",
  object: "event",
  timestamp: Date.now(),
  type,
});

const deliver = async (
  rawBody: string,
  headers = webhookSigner.signedHeaders(rawBody),
) =>
  app.inject({
    method: "POST",
    url: "/webhooks/clerk",
    headers,
    payload: rawBody,
  });

const userRowsFor = (clerkUserId: string) =>
  database.select().from(users).where(eq(users.clerkUserId, clerkUserId));

describe("POST /webhooks/clerk", () => {
  test("user.created creates the user", async () => {
    const clerkUserId = `user_${randomUUID()}`;
    const response = await deliver(
      JSON.stringify(
        clerkEvent("user.created", { id: clerkUserId, object: "user" }),
      ),
    );
    expect(response.statusCode).toBe(204);
    expect(await userRowsFor(clerkUserId)).toHaveLength(1);
  });

  test("user.created after lazy creation, delivered twice, keeps one row", async () => {
    const clerkUserId = `user_${randomUUID()}`;
    await ensureUser(database, clerkUserId);
    const rawBody = JSON.stringify(
      clerkEvent("user.created", { id: clerkUserId, object: "user" }),
    );
    const headers = webhookSigner.signedHeaders(rawBody, "msg_redelivered");
    expect((await deliver(rawBody, headers)).statusCode).toBe(204);
    expect((await deliver(rawBody, headers)).statusCode).toBe(204);
    expect(await userRowsFor(clerkUserId)).toHaveLength(1);
  });

  test("accepts a signed body that is not compact JSON", async () => {
    const clerkUserId = `user_${randomUUID()}`;
    const prettyBody = JSON.stringify(
      clerkEvent("user.created", { id: clerkUserId, object: "user" }),
      null,
      2,
    );
    expect((await deliver(prettyBody)).statusCode).toBe(204);
    expect(await userRowsFor(clerkUserId)).toHaveLength(1);
  });

  test("user.deleted removes the user and their consents", async () => {
    const clerkUserId = `user_${randomUUID()}`;
    const user = await ensureUser(database, clerkUserId);
    await database
      .insert(consents)
      .values({ userId: user.id, kind: "privacy_notice", version: "1" });
    const rawBody = JSON.stringify(
      clerkEvent("user.deleted", {
        id: clerkUserId,
        object: "user",
        deleted: true,
      }),
    );
    expect((await deliver(rawBody)).statusCode).toBe(204);
    expect(await userRowsFor(clerkUserId)).toHaveLength(0);
    expect(
      await database
        .select()
        .from(consents)
        .where(eq(consents.userId, user.id)),
    ).toHaveLength(0);
  });

  test("ignores event types it does not handle", async () => {
    const rawBody = JSON.stringify(
      clerkEvent("session.created", { id: "sess_1", object: "session" }),
    );
    expect((await deliver(rawBody)).statusCode).toBe(204);
  });

  test("rejects a tampered body", async () => {
    const clerkUserId = `user_${randomUUID()}`;
    const signedBody = JSON.stringify(
      clerkEvent("user.created", { id: clerkUserId, object: "user" }),
    );
    const tamperedBody = signedBody.replace(
      clerkUserId,
      `user_${randomUUID()}`,
    );
    expect(
      (await deliver(tamperedBody, webhookSigner.signedHeaders(signedBody)))
        .statusCode,
    ).toBe(400);
  });

  test("rejects a delivery without Svix headers", async () => {
    const rawBody = JSON.stringify(
      clerkEvent("user.created", {
        id: `user_${randomUUID()}`,
        object: "user",
      }),
    );
    expect(
      (await deliver(rawBody, { "content-type": "application/json" } as never))
        .statusCode,
    ).toBe(400);
  });
});
