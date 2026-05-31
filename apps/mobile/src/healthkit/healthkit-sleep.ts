// Why: HealthKit stores sleep as one sample per stage, while ingest wants one session per night whose id stays
// the same when the night arrives across several syncs.
// Must not: call HealthKit; the reader passes it the samples around what changed.
import type {
  SleepStageName,
  WireSleepSession,
} from "../sync-batches/wire-types.ts";
import type { HealthKitCategorySample } from "./healthkit-metrics.ts";

const sameNightGapMillis = 15 * 60 * 1000;

// HealthKit's CategoryValueSleepAnalysis. Core sleep is Apple's name for light sleep.
const stageByHealthKitValue = new Map<number, SleepStageName>([
  [0, "in_bed"],
  [1, "asleep"],
  [2, "awake"],
  [3, "light"],
  [4, "deep"],
  [5, "rem"],
]);

type SleepNight = {
  firstSample: HealthKitCategorySample;
  samples: HealthKitCategorySample[];
  endMillis: number;
};

function groupIntoNights(
  sourceSamples: readonly HealthKitCategorySample[],
): SleepNight[] {
  const ordered = [...sourceSamples].sort(
    (left, right) =>
      left.startDate.getTime() - right.startDate.getTime() ||
      left.uuid.localeCompare(right.uuid),
  );
  const nights: SleepNight[] = [];
  for (const sample of ordered) {
    const currentNight = nights.at(-1);
    if (
      currentNight === undefined ||
      sample.startDate.getTime() - currentNight.endMillis > sameNightGapMillis
    ) {
      nights.push({
        firstSample: sample,
        samples: [sample],
        endMillis: sample.endDate.getTime(),
      });
      continue;
    }
    currentNight.samples.push(sample);
    currentNight.endMillis = Math.max(
      currentNight.endMillis,
      sample.endDate.getTime(),
    );
  }
  return nights;
}

export function groupSleepSessions(
  samples: readonly HealthKitCategorySample[],
  changedSampleUuids: ReadonlySet<string>,
): WireSleepSession[] {
  const samplesBySource = new Map<string, HealthKitCategorySample[]>();
  for (const sample of samples) {
    const source = sample.sourceRevision.source.bundleIdentifier;
    samplesBySource.set(source, [
      ...(samplesBySource.get(source) ?? []),
      sample,
    ]);
  }

  const sessions: WireSleepSession[] = [];
  for (const [source, sourceSamples] of samplesBySource) {
    for (const night of groupIntoNights(sourceSamples)) {
      if (!night.samples.some((sample) => changedSampleUuids.has(sample.uuid)))
        continue;
      sessions.push({
        externalUuid: `hk-sleep-${night.firstSample.uuid}`,
        startAt: night.firstSample.startDate.toISOString(),
        endAt: new Date(night.endMillis).toISOString(),
        source,
        stages: night.samples.flatMap((sample) => {
          const stage = stageByHealthKitValue.get(sample.value);
          if (stage === undefined) return [];
          return [
            {
              stage,
              startAt: sample.startDate.toISOString(),
              endAt: sample.endDate.toISOString(),
            },
          ];
        }),
      });
    }
  }
  return sessions;
}
