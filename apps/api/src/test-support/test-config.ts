// Why: a complete ApiConfig for tests, pointed at wearwise_test, with well formed placeholder Clerk values.
// Must not: be imported by production code.
import { testDatabaseUrl } from "@wearwise/db/testing";
import type { ApiConfig } from "../config.ts";

export function createTestConfig(
  overrides: Partial<ApiConfig> = {},
): ApiConfig {
  return {
    databaseUrl: testDatabaseUrl,
    host: "127.0.0.1",
    port: 0,
    // Clerk requires both keys to be well formed even when jwtKey makes verification networkless.
    clerkPublishableKey: `pk_test_${btoa("example.clerk.accounts.dev$")}`,
    clerkSecretKey: "sk_test_placeholder",
    clerkJwtKey:
      "-----BEGIN PUBLIC KEY-----\nplaceholder\n-----END PUBLIC KEY-----",
    clerkWebhookSigningSecret: "whsec_placeholder",
    ...overrides,
  };
}
