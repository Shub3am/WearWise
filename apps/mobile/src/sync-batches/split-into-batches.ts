// Why: keep every POST inside the Go ingest's limits, 5000 items and an 8 MiB decoded body, so a large page
// never gets a 400 or a 413.
// Must not: drop, reorder or change items.
import type { SampleBatch } from "./wire-types.ts";

export const maxItemsPerBatch = 5000;
// The cap is on the decoded JSON. Each item costs its own JSON bytes plus one comma; the 1 KiB margin covers the
// braces and the two array keys.
export const maxBatchJsonBytes = 8 * 1024 * 1024 - 1024;

const utf8 = new TextEncoder();

export function splitIntoBatches(batch: SampleBatch): SampleBatch[] {
  const batches: SampleBatch[] = [];
  let current: SampleBatch = { samples: [], sleepSessions: [] };
  let currentItemCount = 0;
  let currentJsonBytes = 0;

  function batchWithRoomFor(item: object): SampleBatch {
    const itemJsonBytes = utf8.encode(JSON.stringify(item)).length + 1;
    const isFull =
      currentItemCount === maxItemsPerBatch ||
      currentJsonBytes + itemJsonBytes > maxBatchJsonBytes;
    if (isFull && currentItemCount > 0) {
      batches.push(current);
      current = { samples: [], sleepSessions: [] };
      currentItemCount = 0;
      currentJsonBytes = 0;
    }
    currentItemCount += 1;
    currentJsonBytes += itemJsonBytes;
    return current;
  }

  for (const sample of batch.samples)
    batchWithRoomFor(sample).samples.push(sample);
  for (const session of batch.sleepSessions)
    batchWithRoomFor(session).sleepSessions.push(session);
  if (currentItemCount > 0) batches.push(current);
  return batches;
}
