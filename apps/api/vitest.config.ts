import { defineConfig } from "vitest/config";

export default defineConfig({
  // @clerk/backend reads its env at import time and enables telemetry for pk_test_ keys.
  test: { env: { CLERK_TELEMETRY_DISABLED: "1" } },
});
