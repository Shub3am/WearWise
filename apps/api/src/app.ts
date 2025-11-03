// Why: assembles the Fastify instance from its route plugins so tests and the server build the same app.
// Must not: read the environment, open connections or listen on a port.
import type { Database } from "@wearwise/db";
import Fastify, { type FastifyError, type FastifyInstance } from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import { authenticatedScope } from "./auth/authenticated-scope.ts";
import { clerkWebhookRoutes } from "./clerk-webhook/clerk-webhook-routes.ts";
import type { ApiConfig } from "./config.ts";
import { healthRoutes } from "./health/health-routes.ts";

export async function buildApp({
  config,
  database,
  logger,
}: {
  config: ApiConfig;
  database: Database;
  logger: boolean;
}): Promise<FastifyInstance> {
  const app = Fastify({ logger });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  // Fastify's default 500 body carries the error message, which for a failed query is the SQL and its parameters.
  app.setErrorHandler<FastifyError>((error, request, reply) => {
    if ((error.statusCode ?? 500) < 500) {
      return reply.send(error);
    }
    request.log.error({ err: error }, "unhandled error");
    return reply.code(500).send({ error: "Internal Server Error" });
  });
  await app.register(healthRoutes, { database });
  await app.register(clerkWebhookRoutes, {
    database,
    signingSecret: config.clerkWebhookSigningSecret,
  });
  await app.register(authenticatedScope, { prefix: "/v1", config, database });
  return app;
}
