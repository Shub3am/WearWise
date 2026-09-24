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

// Same list and order as the Go ingest's sleepStageNames (apps/ingest/internal/samplebatch/samplebatch.go).
export const sleepStageNames = [
  "awake",
  "asleep",
  "light",
  "deep",
  "rem",
  "in_bed",
] as const;

export type SleepStageName = (typeof sleepStageNames)[number];

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
