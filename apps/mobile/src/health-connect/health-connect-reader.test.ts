import {
  getChanges,
  getGrantedPermissions,
  initialize,
  readRecords,
} from "react-native-health-connect";
import { createInMemoryKeyValueStore } from "../storage/in-memory-key-value-store.ts";
import { readAllPages } from "../sync/read-all-pages.ts";
import type { SyncPage } from "../sync/run-sync.ts";
import { readHealthConnectPages } from "./health-connect-reader.ts";

jest.mock("react-native-health-connect", () => ({
  initialize: jest.fn(),
  getGrantedPermissions: jest.fn(),
  getChanges: jest.fn(),
  readRecords: jest.fn(),
}));

const initializeClient = jest.mocked(initialize);
const grantedPermissions = jest.mocked(getGrantedPermissions);
const changesQuery = jest.mocked(getChanges);
const recordsQuery = jest.mocked(readRecords);

const tokenKey = "health-connect-changes-token";
const backfillTimeRange = {
  operator: "after",
  startTime: "2026-06-26T12:00:00.000Z",
};
const dataOrigin = "com.google.android.apps.fitness";
const noChanges = {
  upsertionChanges: [],
  deletionChanges: [],
  nextChangesToken: "unused",
  changesTokenExpired: false,
  hasMore: false,
};

// readRecords leaves recordType off its records; the changes feed includes it.
function stepsRecord(id: string) {
  return {
    startTime: "2026-09-20T08:00:00Z",
    endTime: "2026-09-20T08:15:00Z",
    metadata: { id, dataOrigin },
    count: 1200,
  };
}

const sleepRecord = {
  startTime: "2026-09-19T22:00:00Z",
  endTime: "2026-09-20T06:00:00Z",
  metadata: { id: "sleep-1", dataOrigin },
  stages: [
    {
      startTime: "2026-09-19T22:00:00Z",
      endTime: "2026-09-20T06:00:00Z",
      stage: 4,
    },
  ],
};

function readGrants(...recordTypes: string[]) {
  return recordTypes.map((recordType) => ({ accessType: "read", recordType }));
}

function savedToken(changesToken: string, recordTypes: string[]): string {
  return JSON.stringify({ changesToken, recordTypes });
}

function pageIds(pages: SyncPage[]) {
  return pages.map((page) => [
    page.batch.samples.map((sample) => sample.externalUuid),
    page.batch.sleepSessions.map((session) => session.externalUuid),
  ]);
}

beforeEach(() => {
  jest.resetAllMocks();
  initializeClient.mockResolvedValue(true);
  grantedPermissions.mockResolvedValue(readGrants("Steps") as never);
  changesQuery.mockResolvedValue(noChanges as never);
  recordsQuery.mockResolvedValue({ records: [] } as never);
});

test("backfills every granted read type from 90 days ago, then saves the token minted before it", async () => {
  const store = createInMemoryKeyValueStore();
  grantedPermissions.mockResolvedValue([
    ...readGrants("Steps", "SleepSession", "BackgroundAccessPermission"),
    { accessType: "write", recordType: "HeartRate" },
  ] as never);
  changesQuery.mockResolvedValue({
    ...noChanges,
    nextChangesToken: "t1",
  } as never);
  recordsQuery.mockImplementation((async (
    recordType: string,
    options: { pageToken?: string },
  ) => {
    if (recordType === "SleepSession") return { records: [sleepRecord] };
    if (options.pageToken === undefined)
      return { records: [stepsRecord("s1")], pageToken: "p2" };
    return { records: [stepsRecord("s2")], pageToken: "" };
  }) as never);

  jest.useFakeTimers({ now: new Date("2026-09-24T12:00:00.000Z") });
  const pages = await readAllPages(readHealthConnectPages(store));
  jest.useRealTimers();

  expect(pageIds(pages)).toEqual([
    [["s1"], []],
    [["s2"], []],
    [[], ["sleep-1"]],
    [[], []],
  ]);
  expect(changesQuery).toHaveBeenCalledWith({
    recordTypes: ["Steps", "SleepSession"],
  });
  expect(recordsQuery.mock.calls).toEqual([
    ["Steps", { timeRangeFilter: backfillTimeRange, pageToken: undefined }],
    ["Steps", { timeRangeFilter: backfillTimeRange, pageToken: "p2" }],
    [
      "SleepSession",
      { timeRangeFilter: backfillTimeRange, pageToken: undefined },
    ],
  ]);
  await expect(store.getItemAsync(tokenKey)).resolves.toBe(
    savedToken("t1", ["Steps", "SleepSession"]),
  );
  expect(initializeClient.mock.invocationCallOrder[0]).toBeLessThan(
    grantedPermissions.mock.invocationCallOrder[0] ?? 0,
  );
});

test("a backfill saves the token only on its last page, so one cut off halfway starts over", async () => {
  const store = createInMemoryKeyValueStore();
  changesQuery.mockResolvedValue({
    ...noChanges,
    nextChangesToken: "t1",
  } as never);
  recordsQuery.mockResolvedValue({ records: [stepsRecord("s1")] } as never);

  const pages: SyncPage[] = [];
  for await (const page of readHealthConnectPages(store)) pages.push(page);
  for (const page of pages.slice(0, -1)) await page.saveCursor();

  await expect(store.getItemAsync(tokenKey)).resolves.toBeNull();
  await pages.at(-1)?.saveCursor();
  await expect(store.getItemAsync(tokenKey)).resolves.toBe(
    savedToken("t1", ["Steps"]),
  );
});

test("follows the changes feed from the saved token and keeps only synced record types", async () => {
  const store = createInMemoryKeyValueStore({
    [tokenKey]: savedToken("t1", ["Steps"]),
  });
  const weightRecord = {
    recordType: "Weight",
    time: "2026-09-20T07:00:00Z",
    metadata: { id: "w1", dataOrigin },
    weight: { inKilograms: 70 },
  };
  changesQuery.mockImplementation((async (request: {
    changesToken?: string;
  }) => {
    if (request.changesToken === "t1") {
      return {
        ...noChanges,
        upsertionChanges: [
          { record: { ...stepsRecord("s3"), recordType: "Steps" } },
          { record: weightRecord },
        ],
        nextChangesToken: "t2",
        hasMore: true,
      };
    }
    return {
      ...noChanges,
      upsertionChanges: [
        { record: { ...stepsRecord("s4"), recordType: "Steps" } },
      ],
      nextChangesToken: "t3",
    };
  }) as never);

  const pages = await readAllPages(readHealthConnectPages(store));

  expect(pageIds(pages)).toEqual([
    [["s3"], []],
    [["s4"], []],
  ]);
  expect(
    changesQuery.mock.calls.map(([request]) => request.changesToken),
  ).toEqual(["t1", "t2"]);
  expect(recordsQuery).not.toHaveBeenCalled();
  await expect(store.getItemAsync(tokenKey)).resolves.toBe(
    savedToken("t3", ["Steps"]),
  );
});

test("an expired changes token starts a fresh 90 day backfill with a new token", async () => {
  const store = createInMemoryKeyValueStore({
    [tokenKey]: savedToken("old", ["Steps"]),
  });
  changesQuery.mockImplementation((async (request: {
    changesToken?: string;
  }) => {
    if (request.changesToken === "old")
      return { ...noChanges, changesTokenExpired: true };
    return { ...noChanges, nextChangesToken: "fresh" };
  }) as never);
  recordsQuery.mockResolvedValue({
    records: [stepsRecord("s5")],
    pageToken: "",
  } as never);

  jest.useFakeTimers({ now: new Date("2026-09-24T12:00:00.000Z") });
  const pages = await readAllPages(readHealthConnectPages(store));
  jest.useRealTimers();

  expect(pageIds(pages)).toEqual([
    [["s5"], []],
    [[], []],
  ]);
  expect(recordsQuery).toHaveBeenCalledWith("Steps", {
    timeRangeFilter: backfillTimeRange,
    pageToken: undefined,
  });
  await expect(store.getItemAsync(tokenKey)).resolves.toBe(
    savedToken("fresh", ["Steps"]),
  );
});

test("a newly granted type backfills every granted type instead of following the old token", async () => {
  const store = createInMemoryKeyValueStore({
    [tokenKey]: savedToken("t1", ["Steps"]),
  });
  grantedPermissions.mockResolvedValue(
    readGrants("Steps", "HeartRate") as never,
  );
  changesQuery.mockResolvedValue({
    ...noChanges,
    nextChangesToken: "t9",
  } as never);

  await readAllPages(readHealthConnectPages(store));

  expect(changesQuery.mock.calls).toEqual([
    [{ recordTypes: ["Steps", "HeartRate"] }],
  ]);
  expect(recordsQuery.mock.calls.map(([recordType]) => recordType)).toEqual([
    "Steps",
    "HeartRate",
  ]);
  await expect(store.getItemAsync(tokenKey)).resolves.toBe(
    savedToken("t9", ["Steps", "HeartRate"]),
  );
});

test("reads nothing when no synced type is granted", async () => {
  grantedPermissions.mockResolvedValue([] as never);

  const pages = await readAllPages(
    readHealthConnectPages(createInMemoryKeyValueStore()),
  );

  expect(pages).toEqual([]);
  expect(changesQuery).not.toHaveBeenCalled();
  expect(recordsQuery).not.toHaveBeenCalled();
});
