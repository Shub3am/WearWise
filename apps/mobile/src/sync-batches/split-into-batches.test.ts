import { splitIntoBatches } from "./split-into-batches.ts";
import type { WireSample, WireSleepSession } from "./wire-types.ts";

const utf8 = new TextEncoder();

function heartRateSample(sampleNumber: number): WireSample {
  return {
    metric: "heart_rate",
    externalUuid: `hk-${sampleNumber}`,
    startAt: "2026-09-20T08:00:00.000Z",
    endAt: "2026-09-20T08:00:00.000Z",
    value: 60,
    unit: "bpm",
    source: "com.apple.health",
  };
}

function sleepSession(sessionNumber: number): WireSleepSession {
  return {
    externalUuid: `hk-sleep-${sessionNumber}`,
    startAt: "2026-09-19T22:00:00.000Z",
    endAt: "2026-09-20T06:00:00.000Z",
    source: "com.apple.health",
    stages: [],
  };
}

function numbered<T>(count: number, make: (itemNumber: number) => T): T[] {
  return Array.from({ length: count }, (_unused, index) => make(index));
}

test("splits 12001 samples into batches of 5000, 5000 and 2001 in order", () => {
  const samples = numbered(12001, heartRateSample);
  const batches = splitIntoBatches({ samples, sleepSessions: [] });
  expect(batches.map((batch) => batch.samples.length)).toEqual([
    5000, 5000, 2001,
  ]);
  expect(batches.flatMap((batch) => batch.samples)).toEqual(samples);
});

test("counts sleep sessions toward the 5000 item limit", () => {
  const batches = splitIntoBatches({
    samples: numbered(4999, heartRateSample),
    sleepSessions: numbered(2, sleepSession),
  });
  expect(
    batches.map((batch) => [batch.samples.length, batch.sleepSessions.length]),
  ).toEqual([
    [4999, 1],
    [0, 1],
  ]);
});

test("returns no batches for an empty page", () => {
  expect(splitIntoBatches({ samples: [], sleepSessions: [] })).toEqual([]);
});

test("starts a new batch before the JSON body passes 8 MiB with multibyte text", () => {
  const wideSample: WireSample = {
    metric: "walking_running_distance",
    externalUuid: "😀".repeat(128),
    startAt: "2026-09-20T08:00:00.000Z",
    endAt: "2026-09-20T08:05:00.000Z",
    value: 0.123456789012345,
    unit: "km",
    source: "😀".repeat(256),
  };
  const page = { samples: numbered(5000, () => wideSample), sleepSessions: [] };
  expect(utf8.encode(JSON.stringify(page)).length).toBeGreaterThan(
    8 * 1024 * 1024,
  );

  const batches = splitIntoBatches(page);

  expect(batches).toHaveLength(2);
  for (const batch of batches) {
    expect(utf8.encode(JSON.stringify(batch)).length).toBeLessThanOrEqual(
      8 * 1024 * 1024,
    );
  }
});
