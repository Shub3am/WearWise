// Why: process entry point that wires config, database and app, then listens.
// Must not: define routes or read env beyond readApiConfig.
import { createDatabase } from "@wearwise/db";
import { buildApp } from "./app.ts";
import { readApiConfig } from "./config.ts";

const config = readApiConfig(process.env);
const database = createDatabase(config.databaseUrl);
const app = await buildApp({ config, database, logger: true });

// Node as container PID 1 ignores SIGTERM unless handled, so Docker would wait 10s and SIGKILL mid request.
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, async () => {
    await app.close();
    await database.$client.end();
  });
}

await app.listen({ host: config.host, port: config.port });
