import { keepWhatIngestAccepts } from "./ingest-acceptance.ts";
import type { WireSample, WireSleepSession } from "./wire-types.ts";

const validSample: WireSample = {
  metric: "step_count",
  externalUuid: "hk-1",
  startAt: "2026-09-20T08:00:00.000Z",
  endAt: "2026-09-20T08:05:00.000Z",
  value: 420,
  unit: "count",
  source: "com.apple.health",
};

const validSession: WireSleepSession = {
  externalUuid: "hk-sleep-1",
  startAt: "2026-09-19T22:00:00.000Z",
  endAt: "2026-09-20T06:00:00.000Z",
  source: "com.apple.health",
  stages: [
    {
      stage: "deep",
      startAt: "2026-09-19T23:00:00.000Z",
      endAt: "2026-09-19T23:30:00.000Z",
    },
  ],
};

test("keeps valid samples and sleep sessions unchanged", () => {
  const batch = { samples: [validSample], sleepSessions: [validSession] };
  expect(keepWhatIngestAccepts(batch)).toEqual(batch);
});

test("keeps an external uuid of 128 four byte characters and drops one of 129", () => {
  const atLimit = { ...validSample, externalUuid: "😀".repeat(128) };
  const overLimit = { ...validSample, externalUuid: "😀".repeat(129) };
  expect(
    keepWhatIngestAccepts({ samples: [atLimit, overLimit], sleepSessions: [] })
      .samples,
  ).toEqual([atLimit]);
});

const rejectedSampleOverrides: [string, Partial<WireSample>][] = [
  ["a NaN value", { value: Number.NaN }],
  ["a NUL in the source", { source: "com.apple\u0000health" }],
  ["an empty external uuid", { externalUuid: "" }],
  ["a year past 9999", { endAt: "+010000-01-01T00:00:00.000Z" }],
  ["an end before its start", { endAt: "2026-09-20T07:59:00.000Z" }],
  ["a unit other than the catalog's", { unit: "km" }],
  ["sleep_analysis sent as a sample", { metric: "sleep_analysis", unit: "hr" }],
];

test.each(rejectedSampleOverrides)(
  "drops a sample with %s and keeps the rest",
  (_caseName, override) => {
    const rejected = { ...validSample, ...override };
    expect(
      keepWhatIngestAccepts({
        samples: [validSample, rejected],
        sleepSessions: [],
      }).samples,
    ).toEqual([validSample]);
  },
);

test("drops a sleep session whose end equals its start", () => {
  const zeroLength = { ...validSession, endAt: validSession.startAt };
  expect(
    keepWhatIngestAccepts({ samples: [], sleepSessions: [zeroLength] })
      .sleepSessions,
  ).toEqual([]);
});

test("drops a stage that runs past its session and keeps the session", () => {
  const lateStage = {
    stage: "rem",
    startAt: "2026-09-20T05:50:00.000Z",
    endAt: "2026-09-20T06:10:00.000Z",
  } as const;
  const session = {
    ...validSession,
    stages: [...validSession.stages, lateStage],
  };
  expect(
    keepWhatIngestAccepts({ samples: [], sleepSessions: [session] })
      .sleepSessions,
  ).toEqual([validSession]);
});
