import type { HealthConnectRecordResult } from "react-native-health-connect";
import {
  isSyncedRecord,
  recordToSampleBatch,
  type SyncedRecord,
} from "./health-connect-records.ts";

const metadata = { id: "rec-1", dataOrigin: "com.google.android.apps.fitness" };
const interval = {
  startTime: "2026-09-20T08:00:00Z",
  endTime: "2026-09-20T08:15:00Z",
  metadata,
};
const instant = { time: "2026-09-20T07:00:00Z", metadata };

const oneValueCases: [
  string,
  SyncedRecord,
  {
    metric: string;
    value: number;
    unit: string;
    startAt: string;
    endAt: string;
  },
][] = [
  [
    "Steps",
    { recordType: "Steps", ...interval, count: 1200 },
    {
      metric: "step_count",
      value: 1200,
      unit: "count",
      startAt: interval.startTime,
      endAt: interval.endTime,
    },
  ],
  [
    "Distance",
    {
      recordType: "Distance",
      ...interval,
      distance: {
        inMeters: 1500,
        inKilometers: 1.5,
        inMiles: 0.932,
        inInches: 59055,
        inFeet: 4921,
      },
    },
    {
      metric: "walking_running_distance",
      value: 1.5,
      unit: "km",
      startAt: interval.startTime,
      endAt: interval.endTime,
    },
  ],
  [
    "FloorsClimbed",
    { recordType: "FloorsClimbed", ...interval, floors: 3 },
    {
      metric: "flights_climbed",
      value: 3,
      unit: "count",
      startAt: interval.startTime,
      endAt: interval.endTime,
    },
  ],
  [
    "ActiveCaloriesBurned",
    {
      recordType: "ActiveCaloriesBurned",
      ...interval,
      energy: {
        inCalories: 85000,
        inJoules: 355640,
        inKilocalories: 85,
        inKilojoules: 355.64,
      },
    },
    {
      metric: "active_energy",
      value: 85,
      unit: "kcal",
      startAt: interval.startTime,
      endAt: interval.endTime,
    },
  ],
  [
    "RestingHeartRate",
    { recordType: "RestingHeartRate", ...instant, beatsPerMinute: 54 },
    {
      metric: "resting_heart_rate",
      value: 54,
      unit: "bpm",
      startAt: instant.time,
      endAt: instant.time,
    },
  ],
  [
    "HeartRateVariabilityRmssd",
    {
      recordType: "HeartRateVariabilityRmssd",
      ...instant,
      heartRateVariabilityMillis: 48,
    },
    {
      metric: "heart_rate_variability",
      value: 48,
      unit: "ms",
      startAt: instant.time,
      endAt: instant.time,
    },
  ],
  [
    "RespiratoryRate",
    { recordType: "RespiratoryRate", ...instant, rate: 14 },
    {
      metric: "respiratory_rate",
      value: 14,
      unit: "breaths/min",
      startAt: instant.time,
      endAt: instant.time,
    },
  ],
  [
    "OxygenSaturation",
    { recordType: "OxygenSaturation", ...instant, percentage: 97 },
    {
      metric: "blood_oxygen_saturation",
      value: 97,
      unit: "%",
      startAt: instant.time,
      endAt: instant.time,
    },
  ],
];

test.each(oneValueCases)(
  "maps a %s record to one sample",
  (_recordType, record, expected) => {
    expect(recordToSampleBatch(record)).toEqual({
      samples: [
        {
          ...expected,
          externalUuid: "rec-1",
          source: "com.google.android.apps.fitness",
        },
      ],
      sleepSessions: [],
    });
  },
);

test("maps each heart rate point to its own sample", () => {
  const record: SyncedRecord = {
    recordType: "HeartRate",
    ...interval,
    samples: [
      { time: "2026-09-20T08:00:00Z", beatsPerMinute: 72 },
      { time: "2026-09-20T08:00:05Z", beatsPerMinute: 75 },
    ],
  };
  expect(recordToSampleBatch(record).samples).toEqual([
    {
      metric: "heart_rate",
      externalUuid: "rec-1:2026-09-20T08:00:00Z",
      startAt: "2026-09-20T08:00:00Z",
      endAt: "2026-09-20T08:00:00Z",
      value: 72,
      unit: "bpm",
      source: "com.google.android.apps.fitness",
    },
    {
      metric: "heart_rate",
      externalUuid: "rec-1:2026-09-20T08:00:05Z",
      startAt: "2026-09-20T08:00:05Z",
      endAt: "2026-09-20T08:00:05Z",
      value: 75,
      unit: "bpm",
      source: "com.google.android.apps.fitness",
    },
  ]);
});

test("maps a sleep session with its stages and drops unknown stages", () => {
  const record: SyncedRecord = {
    recordType: "SleepSession",
    startTime: "2026-09-19T22:00:00Z",
    endTime: "2026-09-20T06:00:00Z",
    metadata,
    stages: [
      {
        startTime: "2026-09-19T22:00:00Z",
        endTime: "2026-09-19T22:10:00Z",
        stage: 0,
      },
      {
        startTime: "2026-09-19T22:10:00Z",
        endTime: "2026-09-19T23:00:00Z",
        stage: 4,
      },
      {
        startTime: "2026-09-19T23:00:00Z",
        endTime: "2026-09-20T00:00:00Z",
        stage: 5,
      },
      {
        startTime: "2026-09-20T00:00:00Z",
        endTime: "2026-09-20T01:00:00Z",
        stage: 6,
      },
      {
        startTime: "2026-09-20T01:00:00Z",
        endTime: "2026-09-20T01:05:00Z",
        stage: 1,
      },
      {
        startTime: "2026-09-20T01:05:00Z",
        endTime: "2026-09-20T01:10:00Z",
        stage: 3,
      },
      {
        startTime: "2026-09-20T01:10:00Z",
        endTime: "2026-09-20T02:00:00Z",
        stage: 2,
      },
      {
        startTime: "2026-09-20T02:00:00Z",
        endTime: "2026-09-20T06:00:00Z",
        stage: 7,
      },
    ],
  };
  expect(recordToSampleBatch(record)).toEqual({
    samples: [],
    sleepSessions: [
      {
        externalUuid: "rec-1",
        startAt: "2026-09-19T22:00:00Z",
        endAt: "2026-09-20T06:00:00Z",
        source: "com.google.android.apps.fitness",
        stages: [
          {
            stage: "light",
            startAt: "2026-09-19T22:10:00Z",
            endAt: "2026-09-19T23:00:00Z",
          },
          {
            stage: "deep",
            startAt: "2026-09-19T23:00:00Z",
            endAt: "2026-09-20T00:00:00Z",
          },
          {
            stage: "rem",
            startAt: "2026-09-20T00:00:00Z",
            endAt: "2026-09-20T01:00:00Z",
          },
          {
            stage: "awake",
            startAt: "2026-09-20T01:00:00Z",
            endAt: "2026-09-20T01:05:00Z",
          },
          {
            stage: "awake",
            startAt: "2026-09-20T01:05:00Z",
            endAt: "2026-09-20T01:10:00Z",
          },
          {
            stage: "asleep",
            startAt: "2026-09-20T01:10:00Z",
            endAt: "2026-09-20T02:00:00Z",
          },
          {
            stage: "awake",
            startAt: "2026-09-20T02:00:00Z",
            endAt: "2026-09-20T06:00:00Z",
          },
        ],
      },
    ],
  });
});

test("sends nothing for a record without an id or a data origin", () => {
  const record: SyncedRecord = {
    recordType: "Steps",
    ...interval,
    metadata: { dataOrigin: "com.google.android.apps.fitness" },
    count: 10,
  };
  expect(recordToSampleBatch(record)).toEqual({
    samples: [],
    sleepSessions: [],
  });
});

test("tells synced record types from the rest", () => {
  const steps: HealthConnectRecordResult = {
    recordType: "Steps",
    ...interval,
    count: 10,
  };
  const height: HealthConnectRecordResult = {
    recordType: "Height",
    ...instant,
    height: {
      inMeters: 1.8,
      inKilometers: 0.0018,
      inMiles: 0.00112,
      inInches: 70.9,
      inFeet: 5.91,
    },
  };
  expect([isSyncedRecord(steps), isSyncedRecord(height)]).toEqual([
    true,
    false,
  ]);
});
