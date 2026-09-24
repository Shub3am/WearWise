// Why: turn Health Connect's changes feed into sync pages whose cursor is the changes token, with a 90 day backfill
// the first time, when the token expires and when the granted types change.
// Must not: post, encode or filter; runSync does that.
import {
  getChanges,
  getGrantedPermissions,
  initialize,
  readRecords,
} from "react-native-health-connect";
import type { KeyValueStore } from "../storage/key-value-store.ts";
import type { SyncPage } from "../sync/run-sync.ts";
import type { SampleBatch } from "../sync-batches/wire-types.ts";
import {
  isSyncedRecord,
  recordToSampleBatch,
  type SyncedRecord,
  type SyncedRecordType,
  syncedRecordTypes,
} from "./health-connect-records.ts";

const changesTokenKey = "health-connect-changes-token";
const backfillDays = 90;
const dayMillis = 24 * 60 * 60 * 1000;

type SavedChangesToken = {
  changesToken: string;
  recordTypes: SyncedRecordType[];
};

function recordsToSampleBatch(records: readonly SyncedRecord[]): SampleBatch {
  const batches = records.map(recordToSampleBatch);
  return {
    samples: batches.flatMap((batch) => batch.samples),
    sleepSessions: batches.flatMap((batch) => batch.sleepSessions),
  };
}

function saveChangesToken(
  store: KeyValueStore,
  changesToken: string,
  recordTypes: SyncedRecordType[],
) {
  return () =>
    store.setItemAsync(
      changesTokenKey,
      JSON.stringify({ changesToken, recordTypes }),
    );
}

async function grantedReadTypes(): Promise<SyncedRecordType[]> {
  const granted = await getGrantedPermissions();
  return syncedRecordTypes.filter((recordType) =>
    granted.some(
      (permission) =>
        permission.accessType === "read" &&
        permission.recordType === recordType,
    ),
  );
}

// Returns true when the token has expired, before anything was read.
async function* changesSince(
  store: KeyValueStore,
  saved: SavedChangesToken,
): AsyncGenerator<SyncPage, boolean> {
  let changesToken = saved.changesToken;
  while (true) {
    const changes = await getChanges({ changesToken });
    if (changes.changesTokenExpired) return true;
    const records = changes.upsertionChanges
      .map((change) => change.record)
      .filter(isSyncedRecord);
    yield {
      batch: recordsToSampleBatch(records),
      saveCursor: saveChangesToken(
        store,
        changes.nextChangesToken,
        saved.recordTypes,
      ),
    };
    if (!changes.hasMore) return false;
    changesToken = changes.nextChangesToken;
  }
}

async function* backfill(
  store: KeyValueStore,
  recordTypes: SyncedRecordType[],
): AsyncGenerator<SyncPage> {
  // Minted before reading, so a record written during the backfill arrives through the changes feed next time.
  const { nextChangesToken } = await getChanges({ recordTypes });
  const startTime = new Date(
    Date.now() - backfillDays * dayMillis,
  ).toISOString();
  const skipCursor = async () => {};
  for (const recordType of recordTypes) {
    let pageToken: string | undefined;
    do {
      const result = await readRecords(recordType, {
        timeRangeFilter: { operator: "after", startTime },
        pageToken,
      });
      // readRecords leaves recordType off each record; the mapper switches on it.
      const records = result.records.map(
        (record) => ({ ...record, recordType }) as SyncedRecord,
      );
      yield { batch: recordsToSampleBatch(records), saveCursor: skipCursor };
      pageToken = result.pageToken || undefined;
    } while (pageToken !== undefined);
  }
  yield {
    batch: { samples: [], sleepSessions: [] },
    saveCursor: saveChangesToken(store, nextChangesToken, recordTypes),
  };
}

export async function* readHealthConnectPages(
  store: KeyValueStore,
): AsyncGenerator<SyncPage> {
  await initialize();
  const recordTypes = await grantedReadTypes();
  if (recordTypes.length === 0) return;
  const savedValue = await store.getItemAsync(changesTokenKey);
  const saved: SavedChangesToken | undefined =
    savedValue === null ? undefined : JSON.parse(savedValue);
  if (saved !== undefined && saved.recordTypes.join() === recordTypes.join()) {
    const expired = yield* changesSince(store, saved);
    if (!expired) return;
  }
  yield* backfill(store, recordTypes);
}
