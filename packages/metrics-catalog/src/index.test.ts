import { describe, expect, it } from "vitest";
import { isMetricId, metricCatalog } from "./index.ts";

describe("metricCatalog", () => {
  it("ports all 21 metrics from the prototype", () => {
    expect(metricCatalog).toHaveLength(21);
  });

  it("has unique ids", () => {
    const ids = metricCatalog.map((metric) => metric.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("uses platform neutral snake_case ids", () => {
    for (const metric of metricCatalog) {
      expect(metric.id).toMatch(/^[a-z]+(_[a-z]+)*$/);
      expect(metric.id.startsWith("apple_")).toBe(false);
    }
  });
});

describe("isMetricId", () => {
  it("accepts a catalog id", () => {
    expect(isMetricId("resting_heart_rate")).toBe(true);
  });

  it("rejects the prototype's Apple prefixed id", () => {
    expect(isMetricId("apple_exercise_time")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isMetricId("")).toBe(false);
  });
});
