// Why: assembles the Fastify instance from its route plugins so tests and the server build the same app.
// Must not: read the environment, open connections or listen on a port.
import type { Database } from "@wearwise/db";
import Fastify, { type FastifyInstance } from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import { authenticatedScope } from "./auth/authenticated-scope.ts";
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
  await app.register(healthRoutes, { database });
  await app.register(authenticatedScope, { prefix: "/v1", config, database });
  return app;
}
