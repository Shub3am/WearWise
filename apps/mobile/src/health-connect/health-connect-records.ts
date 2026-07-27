// Why: which Health Connect record feeds which catalog metric, in the ingest wire format, so the reader and its tests
// share one mapping.
// Must not: call Health Connect; it imports only types, so it runs under jest without the native module.
import type {
  HealthConnectRecordResult,
  RecordType,
} from "react-native-health-connect";
import type {
  SampleBatch,
  SleepStageName,
} from "../sync-batches/wire-types.ts";

export const syncedRecordTypes = [
  "Steps",
  "Distance",
  "FloorsClimbed",
  "ActiveCaloriesBurned",
  "HeartRate",
  "RestingHeartRate",
  "HeartRateVariabilityRmssd",
  "RespiratoryRate",
  "OxygenSaturation",
  "SleepSession",
] as const satisfies readonly RecordType[];

export type SyncedRecordType = (typeof syncedRecordTypes)[number];
export type SyncedRecord = Extract<
  HealthConnectRecordResult,
  { recordType: SyncedRecordType }
>;

const syncedRecordTypeNames: ReadonlySet<string> = new Set(syncedRecordTypes);

export function isSyncedRecord(
  record: HealthConnectRecordResult,
): record is SyncedRecord {
  return syncedRecordTypeNames.has(record.recordType);
}

// Health Connect's SleepStageType. 0 is UNKNOWN and has no wire stage; 3 is OUT_OF_BED, which counts as awake.
const stageByHealthConnectStage = new Map<number, SleepStageName>([
  [1, "awake"],
  [2, "asleep"],
  [3, "awake"],
  [4, "light"],
  [5, "deep"],
  [6, "rem"],
]);

export function recordToSampleBatch(record: SyncedRecord): SampleBatch {
  const recordId = record.metadata?.id;
  const source = record.metadata?.dataOrigin;
  if (recordId === undefined || source === undefined)
    return { samples: [], sleepSessions: [] };
  const identity = { externalUuid: recordId, source };

  switch (record.recordType) {
    case "Steps":
      return {
        samples: [
          {
            ...identity,
            metric: "step_count",
            startAt: record.startTime,
            endAt: record.endTime,
            value: record.count,
            unit: "count",
          },
        ],
        sleepSessions: [],
      };
    case "Distance":
      return {
        samples: [
          {
            ...identity,
            metric: "walking_running_distance",
            startAt: record.startTime,
            endAt: record.endTime,
            value: record.distance.inKilometers,
            unit: "km",
          },
        ],
        sleepSessions: [],
      };
    case "FloorsClimbed":
      return {
        samples: [
          {
            ...identity,
            metric: "flights_climbed",
            startAt: record.startTime,
            endAt: record.endTime,
            value: record.floors,
            unit: "count",
          },
        ],
        sleepSessions: [],
      };
    case "ActiveCaloriesBurned":
      return {
        samples: [
          {
            ...identity,
            metric: "active_energy",
            startAt: record.startTime,
            endAt: record.endTime,
            value: record.energy.inKilocalories,
            unit: "kcal",
          },
        ],
        sleepSessions: [],
      };
    case "HeartRate":
      return {
        samples: record.samples.map((point) => ({
          externalUuid: `${recordId}:${point.time}`,
          source,
          metric: "heart_rate",
          startAt: point.time,
          endAt: point.time,
          value: point.beatsPerMinute,
          unit: "bpm",
        })),
        sleepSessions: [],
      };
    case "RestingHeartRate":
      return {
        samples: [
          {
            ...identity,
            metric: "resting_heart_rate",
            startAt: record.time,
            endAt: record.time,
            value: record.beatsPerMinute,
            unit: "bpm",
          },
        ],
        sleepSessions: [],
      };
    case "HeartRateVariabilityRmssd":
      return {
        samples: [
          {
            ...identity,
            metric: "heart_rate_variability",
            startAt: record.time,
            endAt: record.time,
            value: record.heartRateVariabilityMillis,
            unit: "ms",
          },
        ],
        sleepSessions: [],
      };
    case "RespiratoryRate":
      return {
        samples: [
          {
            ...identity,
            metric: "respiratory_rate",
            startAt: record.time,
            endAt: record.time,
            value: record.rate,
            unit: "breaths/min",
          },
        ],
        sleepSessions: [],
      };
    case "OxygenSaturation":
      return {
        samples: [
          {
            ...identity,
            metric: "blood_oxygen_saturation",
            startAt: record.time,
            endAt: record.time,
            value: record.percentage,
            unit: "%",
          },
        ],
        sleepSessions: [],
      };
    case "SleepSession":
      return {
        samples: [],
        sleepSessions: [
          {
            ...identity,
            startAt: record.startTime,
            endAt: record.endTime,
            stages: (record.stages ?? []).flatMap((stage) => {
              const stageName = stageByHealthConnectStage.get(stage.stage);
              if (stageName === undefined) return [];
              return [
                {
                  stage: stageName,
                  startAt: stage.startTime,
                  endAt: stage.endTime,
                },
              ];
            }),
          },
        ],
      };
  }
}
