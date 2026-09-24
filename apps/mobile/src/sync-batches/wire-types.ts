// Why: the JSON shape the Go ingest's POST /v1/samples accepts, as TS types, so every mapper produces the same shape.
// Must not: hold logic or platform types.
import type { MetricId, MetricUnit } from "@wearwise/metrics-catalog";

export type WireSample = {
  metric: MetricId;
  externalUuid: string;
  startAt: string;
  endAt: string;
  value: number;
  unit: MetricUnit;
  source: string;
};

export type SleepStageName =
  | "awake"
  | "asleep"
  | "light"
  | "deep"
  | "rem"
  | "in_bed";

export type WireSleepStage = {
  stage: SleepStageName;
  startAt: string;
  endAt: string;
};

export type WireSleepSession = {
  externalUuid: string;
  startAt: string;
  endAt: string;
  source: string;
  stages: WireSleepStage[];
};

export type SampleBatch = {
  samples: WireSample[];
  sleepSessions: WireSleepSession[];
};
