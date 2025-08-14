import { describe, expect, test } from "vitest";
import { readApiConfig } from "./config.ts";

const completeEnvironment = {
  DATABASE_URL:
    "postgres://wearwise:wearwise@localhost:55432/wearwise?sslmode=disable",
  CLERK_PUBLISHABLE_KEY: "pk_test_abc",
  CLERK_SECRET_KEY: "sk_test_abc",
  CLERK_JWT_KEY: "-----BEGIN PUBLIC KEY-----\nabc\n-----END PUBLIC KEY-----",
  CLERK_WEBHOOK_SIGNING_SECRET: "whsec_abc",
};

describe("readApiConfig", () => {
  test("defaults host and port", () => {
    const config = readApiConfig(completeEnvironment);
    expect(config.host).toBe("0.0.0.0");
    expect(config.port).toBe(3000);
  });

  test("reads PORT as a number", () => {
    expect(readApiConfig({ ...completeEnvironment, PORT: "8080" }).port).toBe(
      8080,
    );
  });

  test("names every missing variable", () => {
    expect(() => readApiConfig({})).toThrow(
      /DATABASE_URL[\s\S]*CLERK_SECRET_KEY/,
    );
  });

  test("rejects a JWT key with literal backslash n escapes", () => {
    const escapedKey =
      "-----BEGIN PUBLIC KEY-----\\nabc\\n-----END PUBLIC KEY-----";
    expect(() =>
      readApiConfig({ ...completeEnvironment, CLERK_JWT_KEY: escapedKey }),
    ).toThrow(/real newlines/);
  });
});
