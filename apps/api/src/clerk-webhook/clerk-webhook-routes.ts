// Why: mirrors Clerk user creation and deletion into the users table.
// Must not: trust any body it has not verified against the raw signed bytes.
import { verifyWebhook } from "@clerk/backend/webhooks";
import type { Database } from "@wearwise/db";
import type { FastifyPluginAsync } from "fastify";
import { deleteUserByClerkId, ensureUser } from "../users/user-store.ts";

export const clerkWebhookRoutes: FastifyPluginAsync<{
  database: Database;
  signingSecret: string;
}> = async (scope, { database, signingSecret }) => {
  // Svix signs the exact bytes Clerk sent. @clerk/fastify's verifyWebhook re-stringifies the parsed body and
  // rejects valid non-compact payloads, so this scope keeps JSON bodies as raw strings and verifies those.
  scope.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (_request, rawBody, done) => done(null, rawBody),
  );

  scope.post("/webhooks/clerk", async (request, reply) => {
    const signedRequest = new Request("http://internal/webhooks/clerk", {
      method: "POST",
      headers: request.headers as Record<string, string>,
      body: request.body as string,
    });
    const event = await verifyWebhook(signedRequest, { signingSecret }).catch(
      (error: unknown) => {
        request.log.warn({ err: error }, "rejected Clerk webhook");
        return undefined;
      },
    );
    if (!event)
      return reply.code(400).send({ error: "Invalid webhook signature" });

    // Svix delivers at least once and Clerk does not promise order; both handlers are idempotent.
    if (event.type === "user.created")
      await ensureUser(database, event.data.id);
    if (event.type === "user.deleted" && event.data.id)
      await deleteUserByClerkId(database, event.data.id);
    return reply.code(204).send();
  });
};
