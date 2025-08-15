// Why: one encapsulated scope where every route requires a valid Clerk session token.
// Must not: contain route handlers; it only authenticates and then registers the /v1 route plugins.
import { clerkPlugin, getAuth } from "@clerk/fastify";
import type { Database } from "@wearwise/db";
import type { FastifyPluginAsync } from "fastify";
import type { ApiConfig } from "../config.ts";
import { meRoutes } from "../users/me-routes.ts";

declare module "fastify" {
  interface FastifyRequest {
    clerkUserId: string;
  }
}

export const authenticatedScope: FastifyPluginAsync<{
  config: ApiConfig;
  database: Database;
}> = async (scope, { config, database }) => {
  // jwtKey makes verification networkless. authorizedParties stays unset: native tokens carry no azp.
  await scope.register(clerkPlugin, {
    publishableKey: config.clerkPublishableKey,
    secretKey: config.clerkSecretKey,
    jwtKey: config.clerkJwtKey,
    hookName: "onRequest",
  });
  scope.decorateRequest("clerkUserId", "");
  scope.addHook("onRequest", async (request, reply) => {
    const auth = getAuth(request);
    if (!auth.isAuthenticated)
      return reply.code(401).send({ error: "Unauthorized" });
    request.clerkUserId = auth.userId;
  });
  await scope.register(meRoutes, { database });
};
