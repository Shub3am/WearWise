import { metricCatalog } from "@wearwise/metrics-catalog";
import {
  type HealthKitCategorySample,
  type HealthKitQuantitySample,
  healthKitQuantityMetrics,
  standHourToWireSample,
  toWireSample,
} from "./healthkit-metrics.ts";

const watch = { source: { bundleIdentifier: "com.apple.health.watch" } };

function quantitySample(quantity: number): HealthKitQuantitySample {
  return {
    uuid: "A1B2",
    startDate: new Date("2026-09-20T08:00:00.000Z"),
    endDate: new Date("2026-09-20T08:01:00.000Z"),
    quantity,
    sourceRevision: watch,
  };
}

function entryFor(metric: string) {
  const entry = healthKitQuantityMetrics.find(
    (candidate) => candidate.metric === metric,
  );
  if (entry === undefined) throw new Error(`no HealthKit entry for ${metric}`);
  return entry;
}

test("every entry sends the catalog's canonical unit", () => {
  for (const entry of healthKitQuantityMetrics) {
    const catalogEntry = metricCatalog.find(
      (metric) => metric.id === entry.metric,
    );
    expect([entry.metric, entry.unit]).toEqual([
      entry.metric,
      catalogEntry?.unit,
    ]);
  }
});

test("covers every catalog metric except sleep and stand hours, which have their own mappers", () => {
  const mapped = healthKitQuantityMetrics.map((entry) => entry.metric).sort();
  const expected = metricCatalog
    .map((metric) => metric.id)
    .filter(
      (metricId) => metricId !== "sleep_analysis" && metricId !== "stand_hours",
    )
    .sort();
  expect(mapped).toEqual(expected);
});

test("maps a quantity sample to the wire format with ISO times and the source bundle id", () => {
  expect(toWireSample(entryFor("heart_rate"), quantitySample(61))).toEqual({
    metric: "heart_rate",
    externalUuid: "A1B2",
    startAt: "2026-09-20T08:00:00.000Z",
    endAt: "2026-09-20T08:01:00.000Z",
    value: 61,
    unit: "bpm",
    source: "com.apple.health.watch",
  });
});

test("turns HealthKit's oxygen saturation fraction into a percentage", () => {
  expect(
    toWireSample(entryFor("blood_oxygen_saturation"), quantitySample(0.95))
      .value,
  ).toBeCloseTo(95, 10);
});

function standHour(value: number): HealthKitCategorySample {
  return {
    uuid: "S1",
    startDate: new Date("2026-09-20T09:00:00.000Z"),
    endDate: new Date("2026-09-20T10:00:00.000Z"),
    value,
    sourceRevision: watch,
  };
}

test("counts an hour the user stood as one stand hour", () => {
  expect(standHourToWireSample(standHour(0))).toEqual({
    metric: "stand_hours",
    externalUuid: "S1",
    startAt: "2026-09-20T09:00:00.000Z",
    endAt: "2026-09-20T10:00:00.000Z",
    value: 1,
    unit: "count",
    source: "com.apple.health.watch",
  });
});

test("sends nothing for an idle hour", () => {
  expect(standHourToWireSample(standHour(1))).toBeUndefined();
});
