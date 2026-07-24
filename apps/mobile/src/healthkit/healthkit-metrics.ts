// Why: which HealthKit quantity type feeds which catalog metric, in which unit, so the reader and its tests share
// one table.
// Must not: call HealthKit; it imports only types, so it runs under jest without the native module.
import type {
  QuantityTypeIdentifier,
  queryQuantitySamplesWithAnchor,
} from "@kingstinct/react-native-healthkit";
import type { MetricId, MetricUnit } from "@wearwise/metrics-catalog";
import type { WireSample } from "../sync-batches/wire-types.ts";

type HealthKitSource = { source: { bundleIdentifier: string } };

export type HealthKitQuantitySample = {
  uuid: string;
  startDate: Date;
  endDate: Date;
  quantity: number;
  sourceRevision: HealthKitSource;
};

export type HealthKitCategorySample = {
  uuid: string;
  startDate: Date;
  endDate: Date;
  value: number;
  sourceRevision: HealthKitSource;
};

type HealthKitQueryUnit = NonNullable<
  Parameters<typeof queryQuantitySamplesWithAnchor>[1]["unit"]
>;

export type HealthKitQuantityMetric = {
  metric: MetricId;
  identifier: QuantityTypeIdentifier;
  queryUnit: HealthKitQueryUnit;
  unit: MetricUnit;
  scale: number;
};

// queryUnit is always passed: without it HealthKit answers in the user's preferred unit (miles, degF).
// HealthKit's percent unit is a 0 to 1 fraction, hence the scale of 100 for oxygen saturation.
export const healthKitQuantityMetrics: HealthKitQuantityMetric[] = [
  {
    metric: "exercise_time",
    identifier: "HKQuantityTypeIdentifierAppleExerciseTime",
    queryUnit: "min",
    unit: "min",
    scale: 1,
  },
  {
    metric: "walking_speed",
    identifier: "HKQuantityTypeIdentifierWalkingSpeed",
    queryUnit: "km/hr",
    unit: "km/h",
    scale: 1,
  },
  {
    metric: "stand_time",
    identifier: "HKQuantityTypeIdentifierAppleStandTime",
    queryUnit: "min",
    unit: "min",
    scale: 1,
  },
  {
    metric: "step_count",
    identifier: "HKQuantityTypeIdentifierStepCount",
    queryUnit: "count",
    unit: "count",
    scale: 1,
  },
  {
    metric: "walking_running_distance",
    identifier: "HKQuantityTypeIdentifierDistanceWalkingRunning",
    queryUnit: "km",
    unit: "km",
    scale: 1,
  },
  {
    metric: "flights_climbed",
    identifier: "HKQuantityTypeIdentifierFlightsClimbed",
    queryUnit: "count",
    unit: "count",
    scale: 1,
  },
  {
    metric: "active_energy",
    identifier: "HKQuantityTypeIdentifierActiveEnergyBurned",
    queryUnit: "kcal",
    unit: "kcal",
    scale: 1,
  },
  {
    metric: "physical_effort",
    identifier: "HKQuantityTypeIdentifierPhysicalEffort",
    queryUnit: "kcal/(kg*hr)",
    unit: "kcal/hr·kg",
    scale: 1,
  },
  {
    metric: "heart_rate",
    identifier: "HKQuantityTypeIdentifierHeartRate",
    queryUnit: "count/min",
    unit: "bpm",
    scale: 1,
  },
  {
    metric: "resting_heart_rate",
    identifier: "HKQuantityTypeIdentifierRestingHeartRate",
    queryUnit: "count/min",
    unit: "bpm",
    scale: 1,
  },
  {
    metric: "walking_heart_rate_average",
    identifier: "HKQuantityTypeIdentifierWalkingHeartRateAverage",
    queryUnit: "count/min",
    unit: "bpm",
    scale: 1,
  },
  {
    metric: "heart_rate_variability",
    identifier: "HKQuantityTypeIdentifierHeartRateVariabilitySDNN",
    queryUnit: "ms",
    unit: "ms",
    scale: 1,
  },
  {
    metric: "respiratory_rate",
    identifier: "HKQuantityTypeIdentifierRespiratoryRate",
    queryUnit: "count/min",
    unit: "breaths/min",
    scale: 1,
  },
  {
    metric: "blood_oxygen_saturation",
    identifier: "HKQuantityTypeIdentifierOxygenSaturation",
    queryUnit: "%",
    unit: "%",
    scale: 100,
  },
  {
    metric: "basal_energy",
    identifier: "HKQuantityTypeIdentifierBasalEnergyBurned",
    queryUnit: "kcal",
    unit: "kcal",
    scale: 1,
  },
  {
    metric: "sleeping_wrist_temperature",
    identifier: "HKQuantityTypeIdentifierAppleSleepingWristTemperature",
    queryUnit: "degC",
    unit: "degC",
    scale: 1,
  },
  {
    metric: "time_in_daylight",
    identifier: "HKQuantityTypeIdentifierTimeInDaylight",
    queryUnit: "min",
    unit: "min",
    scale: 1,
  },
  {
    metric: "environmental_audio_exposure",
    identifier: "HKQuantityTypeIdentifierEnvironmentalAudioExposure",
    queryUnit: "dBASPL",
    unit: "dBASPL",
    scale: 1,
  },
  {
    metric: "headphone_audio_exposure",
    identifier: "HKQuantityTypeIdentifierHeadphoneAudioExposure",
    queryUnit: "dBASPL",
    unit: "dBASPL",
    scale: 1,
  },
];

export function toWireSample(
  entry: HealthKitQuantityMetric,
  sample: HealthKitQuantitySample,
): WireSample {
  return {
    metric: entry.metric,
    externalUuid: sample.uuid,
    startAt: sample.startDate.toISOString(),
    endAt: sample.endDate.toISOString(),
    value: sample.quantity * entry.scale,
    unit: entry.unit,
    source: sample.sourceRevision.source.bundleIdentifier,
  };
}

// HealthKit's CategoryValueAppleStandHour: 0 is stood, 1 is idle.
const appleStandHourStood = 0;

export function standHourToWireSample(
  sample: HealthKitCategorySample,
): WireSample | undefined {
  if (sample.value !== appleStandHourStood) return undefined;
  return {
    metric: "stand_hours",
    externalUuid: sample.uuid,
    startAt: sample.startDate.toISOString(),
    endAt: sample.endDate.toISOString(),
    value: 1,
    unit: "count",
    source: sample.sourceRevision.source.bundleIdentifier,
  };
}
