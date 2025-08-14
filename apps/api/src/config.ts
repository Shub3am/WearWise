// Why: turns process environment into a typed ApiConfig once, at startup, and fails loudly on anything missing.
// Must not: read process.env anywhere else in the API.
import { z } from "zod";

const apiEnvironmentSchema = z.object({
  DATABASE_URL: z.string().startsWith("postgres"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().min(0).max(65535).default(3000),
  CLERK_PUBLISHABLE_KEY: z.string().startsWith("pk_"),
  CLERK_SECRET_KEY: z.string().startsWith("sk_"),
  CLERK_JWT_KEY: z
    .string()
    .startsWith("-----BEGIN PUBLIC KEY-----")
    // Clerk's PEM loader fails every token with token-invalid-signature on literal "\n" escapes.
    .refine(
      (pem) => !pem.includes("\\n"),
      "CLERK_JWT_KEY must use real newlines, not \\n escapes",
    ),
  CLERK_WEBHOOK_SIGNING_SECRET: z.string().startsWith("whsec_"),
});

export type ApiConfig = {
  databaseUrl: string;
  host: string;
  port: number;
  clerkPublishableKey: string;
  clerkSecretKey: string;
  clerkJwtKey: string;
  clerkWebhookSigningSecret: string;
};

export function readApiConfig(environment: NodeJS.ProcessEnv): ApiConfig {
  const parsed = apiEnvironmentSchema.parse(environment);
  return {
    databaseUrl: parsed.DATABASE_URL,
    host: parsed.HOST,
    port: parsed.PORT,
    clerkPublishableKey: parsed.CLERK_PUBLISHABLE_KEY,
    clerkSecretKey: parsed.CLERK_SECRET_KEY,
    clerkJwtKey: parsed.CLERK_JWT_KEY,
    clerkWebhookSigningSecret: parsed.CLERK_WEBHOOK_SIGNING_SECRET,
  };
}
