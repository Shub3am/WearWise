import {
  queryCategorySamples,
  queryCategorySamplesWithAnchor,
  queryQuantitySamplesWithAnchor,
} from "@kingstinct/react-native-healthkit";
import { createInMemoryKeyValueStore } from "../storage/in-memory-key-value-store.ts";
import type { SyncPage } from "../sync/run-sync.ts";
import type { HealthKitCategorySample } from "./healthkit-metrics.ts";
import { readHealthKitPages } from "./healthkit-reader.ts";

jest.mock("@kingstinct/react-native-healthkit", () => ({
  queryQuantitySamplesWithAnchor: jest.fn(),
  queryCategorySamplesWithAnchor: jest.fn(),
  queryCategorySamples: jest.fn(),
}));

const quantityQuery = jest.mocked(queryQuantitySamplesWithAnchor);
const categoryAnchoredQuery = jest.mocked(queryCategorySamplesWithAnchor);
const categoryQuery = jest.mocked(queryCategorySamples);

const watch = {
  source: { name: "Apple Watch", bundleIdentifier: "com.apple.health.watch" },
};
const noChanges = { samples: [], deletedSamples: [], newAnchor: "unchanged" };

function sleepSample(
  uuid: string,
  value: number,
  startAt: string,
  endAt: string,
): HealthKitCategorySample {
  return {
    uuid,
    startDate: new Date(startAt),
    endDate: new Date(endAt),
    value,
    sourceRevision: watch,
  };
}

async function readAllPages(
  pages: AsyncGenerator<SyncPage>,
): Promise<SyncPage[]> {
  const readPages: SyncPage[] = [];
  for await (const page of pages) {
    readPages.push(page);
    await page.saveCursor();
  }
  return readPages;
}

beforeEach(() => {
  jest.resetAllMocks();
  quantityQuery.mockResolvedValue(noChanges as never);
  categoryAnchoredQuery.mockResolvedValue(noChanges as never);
  categoryQuery.mockResolvedValue([] as never);
});

test("pages a quantity type from its saved anchor and saves each new anchor", async () => {
  const store = createInMemoryKeyValueStore({
    "healthkit-anchor:step_count": "saved",
  });
  const stepSample = {
    uuid: "A1",
    startDate: new Date("2026-09-20T08:00:00.000Z"),
    endDate: new Date("2026-09-20T08:05:00.000Z"),
    quantity: 420,
    sourceRevision: watch,
  };
  quantityQuery.mockImplementation((async (
    identifier: string,
    options: { anchor?: string },
  ) => {
    if (identifier !== "HKQuantityTypeIdentifierStepCount") return noChanges;
    if (options.anchor === "saved")
      return { samples: [stepSample], deletedSamples: [], newAnchor: "a1" };
    return { samples: [], deletedSamples: [], newAnchor: "a1" };
  }) as never);

  const pages = await readAllPages(readHealthKitPages(store));

  expect(pages.map((page) => page.batch)).toEqual([
    {
      samples: [
        {
          metric: "step_count",
          externalUuid: "A1",
          startAt: "2026-09-20T08:00:00.000Z",
          endAt: "2026-09-20T08:05:00.000Z",
          value: 420,
          unit: "count",
          source: "com.apple.health.watch",
        },
      ],
      sleepSessions: [],
    },
  ]);
  await expect(store.getItemAsync("healthkit-anchor:step_count")).resolves.toBe(
    "a1",
  );
  const stepCalls = quantityQuery.mock.calls.filter(
    ([identifier]) => identifier === "HKQuantityTypeIdentifierStepCount",
  );
  expect(
    stepCalls.map(([, options]) => [
      options.anchor,
      options.limit,
      options.unit,
    ]),
  ).toEqual([
    ["saved", 2000, "count"],
    ["a1", 2000, "count"],
  ]);
});

test("reads from 90 days ago", async () => {
  jest.useFakeTimers({ now: new Date("2026-09-24T12:00:00.000Z") });
  await readAllPages(readHealthKitPages(createInMemoryKeyValueStore()));
  jest.useRealTimers();

  expect(quantityQuery.mock.calls[0]?.[1].filter).toEqual({
    date: { startDate: new Date("2026-06-26T12:00:00.000Z") },
  });
});

test("a page with only deletions sends nothing but moves the anchor", async () => {
  const store = createInMemoryKeyValueStore();
  quantityQuery.mockImplementation((async (
    identifier: string,
    options: { anchor?: string },
  ) => {
    if (
      identifier !== "HKQuantityTypeIdentifierHeartRate" ||
      options.anchor !== undefined
    )
      return noChanges;
    return { samples: [], deletedSamples: [{ uuid: "gone" }], newAnchor: "d1" };
  }) as never);

  const pages = await readAllPages(readHealthKitPages(store));

  expect(pages.map((page) => page.batch)).toEqual([
    { samples: [], sleepSessions: [] },
  ]);
  await expect(store.getItemAsync("healthkit-anchor:heart_rate")).resolves.toBe(
    "d1",
  );
});

test("rebuilds whole nights around changed sleep samples", async () => {
  const s1 = sleepSample(
    "s1",
    3,
    "2026-09-19T22:00:00.000Z",
    "2026-09-20T01:30:00.000Z",
  );
  const s2 = sleepSample(
    "s2",
    4,
    "2026-09-20T01:30:00.000Z",
    "2026-09-20T03:00:00.000Z",
  );
  const s3 = sleepSample(
    "s3",
    5,
    "2026-09-20T03:00:00.000Z",
    "2026-09-20T06:15:00.000Z",
  );
  categoryAnchoredQuery.mockImplementation((async (
    identifier: string,
    options: { anchor?: string },
  ) => {
    if (
      identifier !== "HKCategoryTypeIdentifierSleepAnalysis" ||
      options.anchor !== undefined
    )
      return noChanges;
    return { samples: [s2, s3], deletedSamples: [], newAnchor: "z1" };
  }) as never);
  categoryQuery.mockResolvedValue([s1, s2, s3] as never);

  const pages = await readAllPages(
    readHealthKitPages(createInMemoryKeyValueStore()),
  );

  expect(categoryQuery).toHaveBeenCalledWith(
    "HKCategoryTypeIdentifierSleepAnalysis",
    {
      limit: 0,
      filter: {
        date: {
          startDate: new Date("2026-09-19T01:30:00.000Z"),
          endDate: new Date("2026-09-21T06:15:00.000Z"),
        },
      },
    },
  );
  const sessions = pages.flatMap((page) => page.batch.sleepSessions);
  expect(
    sessions.map((session) => [session.externalUuid, session.stages.length]),
  ).toEqual([["hk-sleep-s1", 3]]);
});

test("sends stood hours from the stand hour category", async () => {
  categoryAnchoredQuery.mockImplementation((async (
    identifier: string,
    options: { anchor?: string },
  ) => {
    if (
      identifier !== "HKCategoryTypeIdentifierAppleStandHour" ||
      options.anchor !== undefined
    )
      return noChanges;
    return {
      samples: [
        sleepSample(
          "stood",
          0,
          "2026-09-20T09:00:00.000Z",
          "2026-09-20T10:00:00.000Z",
        ),
        sleepSample(
          "idle",
          1,
          "2026-09-20T10:00:00.000Z",
          "2026-09-20T11:00:00.000Z",
        ),
      ],
      deletedSamples: [],
      newAnchor: "h1",
    };
  }) as never);

  const pages = await readAllPages(
    readHealthKitPages(createInMemoryKeyValueStore()),
  );

  expect(
    pages
      .flatMap((page) => page.batch.samples)
      .map((sample) => [sample.metric, sample.externalUuid]),
  ).toEqual([["stand_hours", "stood"]]);
});
