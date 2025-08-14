// Why: lets the container healthcheck and Coolify know the API can reach Postgres.
// Must not: require authentication or touch any table.
import type { Database } from "@wearwise/db";
import { sql } from "drizzle-orm";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";

const healthResponseSchema = z.object({
  status: z.enum(["ok", "unavailable"]),
});

export const healthRoutes: FastifyPluginAsyncZod<{
  database: Database;
}> = async (scope, { database }) => {
  scope.get(
    "/healthz",
    {
      schema: {
        response: { 200: healthResponseSchema, 503: healthResponseSchema },
      },
    },
    async (request, reply) => {
      try {
        await database.execute(sql`select 1`);
        return { status: "ok" as const };
      } catch (error) {
        request.log.error({ err: error }, "database ping failed");
        return reply.code(503).send({ status: "unavailable" });
      }
    },
  );
};
