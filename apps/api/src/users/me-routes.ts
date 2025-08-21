// Why: lets the signed in user read their profile and consents.
// Must not: authenticate; the authenticated scope has already set request.clerkUserId.
import {
  type MeResponse,
  meResponseSchema,
  updateMeRequestSchema,
} from "@wearwise/contracts";
import type { Database } from "@wearwise/db";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { type ConsentRow, listConsents } from "../consents/consent-store.ts";
import { ensureUser, type UserRow, updateUserTimezone } from "./user-store.ts";

function toMeResponse(user: UserRow, userConsents: ConsentRow[]): MeResponse {
  return {
    id: user.id,
    timezone: user.timezone,
    createdAt: user.createdAt.toISOString(),
    consents: userConsents.map((consent) => ({
      kind: consent.kind as MeResponse["consents"][number]["kind"],
      version: consent.version,
      acceptedAt: consent.acceptedAt.toISOString(),
    })),
  };
}

export const meRoutes: FastifyPluginAsyncZod<{ database: Database }> = async (
  scope,
  { database },
) => {
  scope.get(
    "/me",
    { schema: { response: { 200: meResponseSchema } } },
    async (request) => {
      const user = await ensureUser(database, request.clerkUserId);
      return toMeResponse(user, await listConsents(database, user.id));
    },
  );

  scope.patch(
    "/me",
    {
      schema: {
        body: updateMeRequestSchema,
        response: { 200: meResponseSchema },
      },
    },
    async (request) => {
      const user = await ensureUser(database, request.clerkUserId);
      const updatedUser = await updateUserTimezone(
        database,
        user.id,
        request.body.timezone,
      );
      return toMeResponse(updatedUser, await listConsents(database, user.id));
    },
  );
};
