// Why: records that the signed in user accepted a versioned notice or consent.
// Must not: authenticate, or decide which consents the app requires.
import { recordConsentRequestSchema } from "@wearwise/contracts";
import type { Database } from "@wearwise/db";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { ensureUser } from "../users/user-store.ts";
import { recordConsent } from "./consent-store.ts";

export const consentRoutes: FastifyPluginAsyncZod<{
  database: Database;
}> = async (scope, { database }) => {
  scope.post(
    "/consents",
    { schema: { body: recordConsentRequestSchema } },
    async (request, reply) => {
      const user = await ensureUser(database, request.clerkUserId);
      await recordConsent(
        database,
        user.id,
        request.body.kind,
        request.body.version,
      );
      return reply.code(204).send();
    },
  );
};
