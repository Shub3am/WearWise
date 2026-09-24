import type { HealthKitCategorySample } from "./healthkit-metrics.ts";
import { groupSleepSessions } from "./healthkit-sleep.ts";

function sleepSample(
  uuid: string,
  value: number,
  startAt: string,
  endAt: string,
  source = "com.apple.health.watch",
): HealthKitCategorySample {
  return {
    uuid,
    startDate: new Date(startAt),
    endDate: new Date(endAt),
    value,
    sourceRevision: { source: { bundleIdentifier: source } },
  };
}

const core = 3;
const deep = 4;
const rem = 5;
const awake = 2;

const s1 = sleepSample(
  "s1",
  core,
  "2026-09-19T22:00:00.000Z",
  "2026-09-19T23:30:00.000Z",
);
const s2 = sleepSample(
  "s2",
  deep,
  "2026-09-19T23:30:00.000Z",
  "2026-09-20T00:30:00.000Z",
);
const s3 = sleepSample(
  "s3",
  rem,
  "2026-09-20T00:30:00.000Z",
  "2026-09-20T01:30:00.000Z",
);
const s4 = sleepSample(
  "s4",
  awake,
  "2026-09-20T01:30:00.000Z",
  "2026-09-20T01:40:00.000Z",
);
const s5 = sleepSample(
  "s5",
  core,
  "2026-09-20T01:40:00.000Z",
  "2026-09-20T05:30:00.000Z",
);
const s6 = sleepSample(
  "s6",
  rem,
  "2026-09-20T05:30:00.000Z",
  "2026-09-20T06:15:00.000Z",
);

test("a night that arrives across two syncs keeps the id of its first sample", () => {
  const firstSync = groupSleepSessions(
    [s1, s2, s3],
    new Set(["s1", "s2", "s3"]),
  );
  const secondSync = groupSleepSessions(
    [s1, s2, s3, s4, s5, s6],
    new Set(["s4", "s5", "s6"]),
  );

  expect(firstSync.map((session) => session.externalUuid)).toEqual([
    "hk-sleep-s1",
  ]);
  expect(secondSync).toEqual([
    {
      externalUuid: "hk-sleep-s1",
      startAt: "2026-09-19T22:00:00.000Z",
      endAt: "2026-09-20T06:15:00.000Z",
      source: "com.apple.health.watch",
      stages: [
        {
          stage: "light",
          startAt: "2026-09-19T22:00:00.000Z",
          endAt: "2026-09-19T23:30:00.000Z",
        },
        {
          stage: "deep",
          startAt: "2026-09-19T23:30:00.000Z",
          endAt: "2026-09-20T00:30:00.000Z",
        },
        {
          stage: "rem",
          startAt: "2026-09-20T00:30:00.000Z",
          endAt: "2026-09-20T01:30:00.000Z",
        },
        {
          stage: "awake",
          startAt: "2026-09-20T01:30:00.000Z",
          endAt: "2026-09-20T01:40:00.000Z",
        },
        {
          stage: "light",
          startAt: "2026-09-20T01:40:00.000Z",
          endAt: "2026-09-20T05:30:00.000Z",
        },
        {
          stage: "rem",
          startAt: "2026-09-20T05:30:00.000Z",
          endAt: "2026-09-20T06:15:00.000Z",
        },
      ],
    },
  ]);
});

test("leaves out a night with no changed sample", () => {
  const lastNight = sleepSample(
    "n1",
    core,
    "2026-09-18T22:00:00.000Z",
    "2026-09-19T06:00:00.000Z",
  );
  const sessions = groupSleepSessions([lastNight, s1, s2], new Set(["s2"]));
  expect(sessions.map((session) => session.externalUuid)).toEqual([
    "hk-sleep-s1",
  ]);
});

test("keeps two sources' overlapping samples in separate sessions", () => {
  const ring = sleepSample(
    "r1",
    deep,
    "2026-09-19T23:00:00.000Z",
    "2026-09-20T01:00:00.000Z",
    "com.ouraring.oura",
  );
  const sessions = groupSleepSessions([s1, ring], new Set(["s1", "r1"]));
  expect(
    sessions.map((session) => [session.externalUuid, session.source]),
  ).toEqual([
    ["hk-sleep-s1", "com.apple.health.watch"],
    ["hk-sleep-r1", "com.ouraring.oura"],
  ]);
});

test("starts a new night after a gap longer than 15 minutes", () => {
  const nap = sleepSample(
    "p1",
    core,
    "2026-09-19T23:46:00.000Z",
    "2026-09-20T00:30:00.000Z",
  );
  const sessions = groupSleepSessions([s1, nap], new Set(["s1", "p1"]));
  expect(sessions.map((session) => session.externalUuid)).toEqual([
    "hk-sleep-s1",
    "hk-sleep-p1",
  ]);
});

test("joins a sample that starts exactly 15 minutes after the night's end", () => {
  const next = sleepSample(
    "p1",
    core,
    "2026-09-19T23:45:00.000Z",
    "2026-09-20T00:30:00.000Z",
  );
  const sessions = groupSleepSessions([s1, next], new Set(["p1"]));
  expect(
    sessions.map((session) => [session.externalUuid, session.stages.length]),
  ).toEqual([["hk-sleep-s1", 2]]);
});
