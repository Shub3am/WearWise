import { describe, expect, test } from "vitest";
import { canonicalTimeZone, timeZoneSchema } from "./time-zone.ts";

describe("canonicalTimeZone", () => {
  test.each([
    ["UTC", "UTC"],
    ["utc", "UTC"],
    ["America/New_York", "America/New_York"],
    ["asia/kolkata", "Asia/Kolkata"],
    ["Asia/Kolkata", "Asia/Kolkata"],
    ["Asia/Calcutta", "Asia/Kolkata"],
    ["Europe/Kyiv", "Europe/Kyiv"],
  ])("accepts %s as %s", (candidate, canonical) => {
    expect(canonicalTimeZone(candidate)).toBe(canonical);
  });

  test.each(["+05:30", "-08:00", "Mars/Base", "", "SystemV/AST4"])(
    "rejects %j",
    (candidate) => {
      expect(canonicalTimeZone(candidate)).toBeUndefined();
    },
  );
});

describe("timeZoneSchema", () => {
  test("outputs the canonical name", () => {
    expect(timeZoneSchema.parse("utc")).toBe("UTC");
  });

  test("fails on an offset", () => {
    expect(timeZoneSchema.safeParse("+05:30").success).toBe(false);
  });
});
