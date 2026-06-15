// Why: move health data from a platform reader to ingest so that a cursor only advances past data ingest stored.
// Must not: know which platform the pages come from, or how a cursor is stored.
import type { IngestOutcome } from "../server-clients/ingest-client.ts";
import { encodeBatchBody } from "../sync-batches/encode-batch-body.ts";
import { keepWhatIngestAccepts } from "../sync-batches/ingest-acceptance.ts";
import { splitIntoBatches } from "../sync-batches/split-into-batches.ts";
import type { SampleBatch } from "../sync-batches/wire-types.ts";

export type SyncPage = { batch: SampleBatch; saveCursor: () => Promise<void> };

export type SyncResult = { outcome: IngestOutcome; storedBatchCount: number };

export async function runSync(
  pages: AsyncIterable<SyncPage>,
  postBatch: (body: Uint8Array<ArrayBuffer>) => Promise<IngestOutcome>,
): Promise<SyncResult> {
  let storedBatchCount = 0;
  // Returning from inside for await calls the reader's return(), so it stops querying the platform.
  for await (const page of pages) {
    for (const batch of splitIntoBatches(keepWhatIngestAccepts(page.batch))) {
      const outcome = await postBatch(encodeBatchBody(batch));
      if (outcome !== "stored") return { outcome, storedBatchCount };
      storedBatchCount += 1;
    }
    await page.saveCursor();
  }
  return { outcome: "stored", storedBatchCount };
}
