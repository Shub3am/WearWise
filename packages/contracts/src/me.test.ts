import { describe, expect, test } from "vitest";
import {
  meResponseSchema,
  recordConsentRequestSchema,
  updateMeRequestSchema,
} from "./me.ts";

describe("updateMeRequestSchema", () => {
  test("canonicalises the time zone", () => {
    expect(updateMeRequestSchema.parse({ timezone: "utc" })).toEqual({
      timezone: "UTC",
    });
  });

  test("rejects a missing time zone", () => {
    expect(updateMeRequestSchema.safeParse({}).success).toBe(false);
  });
});

describe("recordConsentRequestSchema", () => {
  test("accepts a known kind", () => {
    expect(
      recordConsentRequestSchema.parse({
        kind: "privacy_notice",
        version: "2026-09-23",
      }),
    ).toEqual({
      kind: "privacy_notice",
      version: "2026-09-23",
    });
  });

  test("rejects an unknown kind", () => {
    expect(
      recordConsentRequestSchema.safeParse({ kind: "marketing", version: "1" })
        .success,
    ).toBe(false);
  });

  test("rejects an empty version", () => {
    expect(
      recordConsentRequestSchema.safeParse({
        kind: "privacy_notice",
        version: "",
      }).success,
    ).toBe(false);
  });
});

describe("meResponseSchema", () => {
  test("accepts a user with consents", () => {
    const me = {
      id: "0199a8f0-7b2c-7000-8000-000000000001",
      timezone: "UTC",
      createdAt: "2026-09-23T10:00:00.000Z",
      consents: [
        {
          kind: "privacy_notice",
          version: "2026-09-23",
          acceptedAt: "2026-09-23T10:00:00.000Z",
        },
      ],
    };
    expect(meResponseSchema.parse(me)).toEqual(me);
  });
});
