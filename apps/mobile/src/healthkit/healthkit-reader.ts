// Why: turn HealthKit's anchored queries into sync pages whose cursor is the anchor, so each sync reads only what
// changed since the last stored page.
// Must not: post, encode or filter; runSync does that.
import {
  queryCategorySamples,
  queryCategorySamplesWithAnchor,
  queryQuantitySamplesWithAnchor,
} from "@kingstinct/react-native-healthkit";
import type { KeyValueStore } from "../storage/key-value-store.ts";
import type { SyncPage } from "../sync/run-sync.ts";
import type { SampleBatch } from "../sync-batches/wire-types.ts";
import {
  type HealthKitCategorySample,
  healthKitQuantityMetrics,
  standHourToWireSample,
  toWireSample,
} from "./healthkit-metrics.ts";
import { groupSleepSessions } from "./healthkit-sleep.ts";

const pageLimit = 2000;
const backfillDays = 90;
const dayMillis = 24 * 60 * 60 * 1000;

type AnchoredResponse<Sample> = {
  samples: readonly Sample[];
  deletedSamples: readonly unknown[];
  newAnchor: string;
};

function backfillFilter() {
  return {
    date: { startDate: new Date(Date.now() - backfillDays * dayMillis) },
  };
}

// HealthKit has no has-more flag, so paging ends at the first page with neither samples nor deletions.
async function* anchoredPages<Sample>(
  store: KeyValueStore,
  anchorKey: string,
  queryPage: (anchor: string | undefined) => Promise<AnchoredResponse<Sample>>,
  toBatch: (samples: readonly Sample[]) => Promise<SampleBatch> | SampleBatch,
): AsyncGenerator<SyncPage> {
  let anchor = (await store.getItemAsync(anchorKey)) ?? undefined;
  while (true) {
    const response = await queryPage(anchor);
    if (response.samples.length === 0 && response.deletedSamples.length === 0)
      return;
    const newAnchor = response.newAnchor;
    yield {
      batch: await toBatch(response.samples),
      saveCursor: () => store.setItemAsync(anchorKey, newAnchor),
    };
    anchor = newAnchor;
  }
}

async function sleepSessionsAround(
  changedSamples: readonly HealthKitCategorySample[],
): Promise<SampleBatch> {
  if (changedSamples.length === 0) return { samples: [], sleepSessions: [] };
  const earliestStart = Math.min(
    ...changedSamples.map((sample) => sample.startDate.getTime()),
  );
  const latestEnd = Math.max(
    ...changedSamples.map((sample) => sample.endDate.getTime()),
  );
  const nightSamples = await queryCategorySamples(
    "HKCategoryTypeIdentifierSleepAnalysis",
    {
      limit: 0,
      filter: {
        date: {
          startDate: new Date(earliestStart - dayMillis),
          endDate: new Date(latestEnd + dayMillis),
        },
      },
    },
  );
  const changedSampleUuids = new Set(
    changedSamples.map((sample) => sample.uuid),
  );
  return {
    samples: [],
    sleepSessions: groupSleepSessions(nightSamples, changedSampleUuids),
  };
}

export async function* readHealthKitPages(
  store: KeyValueStore,
): AsyncGenerator<SyncPage> {
  for (const entry of healthKitQuantityMetrics) {
    yield* anchoredPages(
      store,
      `healthkit-anchor:${entry.metric}`,
      (anchor) =>
        queryQuantitySamplesWithAnchor(entry.identifier, {
          limit: pageLimit,
          anchor,
          unit: entry.queryUnit,
          filter: backfillFilter(),
        }),
      (samples) => ({
        samples: samples.map((sample) => toWireSample(entry, sample)),
        sleepSessions: [],
      }),
    );
  }
  yield* anchoredPages(
    store,
    "healthkit-anchor:stand_hours",
    (anchor) =>
      queryCategorySamplesWithAnchor("HKCategoryTypeIdentifierAppleStandHour", {
        limit: pageLimit,
        anchor,
        filter: backfillFilter(),
      }),
    (samples) => ({
      samples: samples.flatMap((sample) => standHourToWireSample(sample) ?? []),
      sleepSessions: [],
    }),
  );
  yield* anchoredPages(
    store,
    "healthkit-anchor:sleep_analysis",
    (anchor) =>
      queryCategorySamplesWithAnchor("HKCategoryTypeIdentifierSleepAnalysis", {
        limit: pageLimit,
        anchor,
        filter: backfillFilter(),
      }),
    sleepSessionsAround,
  );
}
