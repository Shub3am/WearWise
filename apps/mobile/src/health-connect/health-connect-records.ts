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
  WireSample,
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

// Health Connect's SleepStageType. 0 is UNKNOWN and has no wire stage; 3 is OUT_OF_BED and 7 is AWAKE_IN_BED,
// both counted as awake.
const stageByHealthConnectStage = new Map<number, SleepStageName>([
  [1, "awake"],
  [2, "asleep"],
  [3, "awake"],
  [4, "light"],
  [5, "deep"],
  [6, "rem"],
  [7, "awake"],
]);

export function recordToSampleBatch(record: SyncedRecord): SampleBatch {
  const recordId = record.metadata?.id;
  const source = record.metadata?.dataOrigin;
  if (recordId === undefined || source === undefined)
    return { samples: [], sleepSessions: [] };
  const identity = { externalUuid: recordId, source };
  const oneSample = (
    metric: WireSample["metric"],
    startAt: string,
    endAt: string,
    value: number,
    unit: WireSample["unit"],
  ): SampleBatch => ({
    samples: [{ ...identity, metric, startAt, endAt, value, unit }],
    sleepSessions: [],
  });

  switch (record.recordType) {
    case "Steps":
      return oneSample(
        "step_count",
        record.startTime,
        record.endTime,
        record.count,
        "count",
      );
    case "Distance":
      return oneSample(
        "walking_running_distance",
        record.startTime,
        record.endTime,
        record.distance.inKilometers,
        "km",
      );
    case "FloorsClimbed":
      return oneSample(
        "flights_climbed",
        record.startTime,
        record.endTime,
        record.floors,
        "count",
      );
    case "ActiveCaloriesBurned":
      return oneSample(
        "active_energy",
        record.startTime,
        record.endTime,
        record.energy.inKilocalories,
        "kcal",
      );
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
      return oneSample(
        "resting_heart_rate",
        record.time,
        record.time,
        record.beatsPerMinute,
        "bpm",
      );
    case "HeartRateVariabilityRmssd":
      return oneSample(
        "heart_rate_variability",
        record.time,
        record.time,
        record.heartRateVariabilityMillis,
        "ms",
      );
    case "RespiratoryRate":
      return oneSample(
        "respiratory_rate",
        record.time,
        record.time,
        record.rate,
        "breaths/min",
      );
    case "OxygenSaturation":
      return oneSample(
        "blood_oxygen_saturation",
        record.time,
        record.time,
        record.percentage,
        "%",
      );
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
