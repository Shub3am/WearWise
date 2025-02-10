// Why: the single list of health metrics WearWise understands, shared by the API,
// worker, mobile app and (through generated code) the Go ingest service. Ported from
// the prototype's 21 parameters with the Apple prefixes removed and canonical units.
// Must not: hold HealthKit or Health Connect identifiers (mobile sync owns those) or
// aggregation rules (the Go metrics engine owns those).

export type MetricCategory =
  | "activity"
  | "cardio"
  | "respiratory"
  | "sleep"
  | "body"
  | "environment";

export type MetricUnit =
  | "min"
  | "hr"
  | "km"
  | "km/h"
  | "count"
  | "kcal"
  | "kcal/hr·kg"
  | "bpm"
  | "ms"
  | "breaths/min"
  | "%"
  | "degC"
  | "dBASPL";

export const metricCatalog = [
  {
    id: "exercise_time",
    label: "Exercise time",
    unit: "min",
    category: "activity",
  },
  {
    id: "walking_speed",
    label: "Walking speed",
    unit: "km/h",
    category: "activity",
  },
  {
    id: "stand_hours",
    label: "Stand hours",
    unit: "count",
    category: "activity",
  },
  { id: "stand_time", label: "Stand time", unit: "min", category: "activity" },
  { id: "step_count", label: "Steps", unit: "count", category: "activity" },
  {
    id: "walking_running_distance",
    label: "Walking and running distance",
    unit: "km",
    category: "activity",
  },
  {
    id: "flights_climbed",
    label: "Flights climbed",
    unit: "count",
    category: "activity",
  },
  {
    id: "active_energy",
    label: "Active energy",
    unit: "kcal",
    category: "activity",
  },
  {
    id: "physical_effort",
    label: "Physical effort",
    unit: "kcal/hr·kg",
    category: "activity",
  },
  { id: "heart_rate", label: "Heart rate", unit: "bpm", category: "cardio" },
  {
    id: "resting_heart_rate",
    label: "Resting heart rate",
    unit: "bpm",
    category: "cardio",
  },
  {
    id: "walking_heart_rate_average",
    label: "Walking heart rate",
    unit: "bpm",
    category: "cardio",
  },
  {
    id: "heart_rate_variability",
    label: "Heart rate variability",
    unit: "ms",
    category: "cardio",
  },
  {
    id: "respiratory_rate",
    label: "Respiratory rate",
    unit: "breaths/min",
    category: "respiratory",
  },
  {
    id: "blood_oxygen_saturation",
    label: "Blood oxygen",
    unit: "%",
    category: "respiratory",
  },
  { id: "sleep_analysis", label: "Sleep", unit: "hr", category: "sleep" },
  {
    id: "basal_energy",
    label: "Resting energy",
    unit: "kcal",
    category: "body",
  },
  {
    id: "sleeping_wrist_temperature",
    label: "Sleeping wrist temperature",
    unit: "degC",
    category: "body",
  },
  {
    id: "time_in_daylight",
    label: "Time in daylight",
    unit: "min",
    category: "environment",
  },
  {
    id: "environmental_audio_exposure",
    label: "Environmental noise",
    unit: "dBASPL",
    category: "environment",
  },
  {
    id: "headphone_audio_exposure",
    label: "Headphone audio",
    unit: "dBASPL",
    category: "environment",
  },
] as const satisfies readonly {
  id: string;
  label: string;
  unit: MetricUnit;
  category: MetricCategory;
}[];

export type MetricId = (typeof metricCatalog)[number]["id"];

const metricIds: ReadonlySet<string> = new Set(
  metricCatalog.map((metric) => metric.id),
);

export function isMetricId(candidate: string): candidate is MetricId {
  return metricIds.has(candidate);
}
