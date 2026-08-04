import { ungzip } from "pako";
import type { IngestOutcome } from "../server-clients/ingest-client.ts";
import type { SampleBatch, WireSample } from "../sync-batches/wire-types.ts";
import { runSync, type SyncPage } from "./run-sync.ts";

function stepSample(itemNumber: number, value = 10): WireSample {
  return {
    metric: "step_count",
    externalUuid: `hk-${itemNumber}`,
    startAt: "2026-09-20T08:00:00.000Z",
    endAt: "2026-09-20T08:05:00.000Z",
    value,
    unit: "count",
    source: "com.apple.health",
  };
}

function batchOf(sampleCount: number): SampleBatch {
  return {
    samples: Array.from({ length: sampleCount }, (_unused, index) =>
      stepSample(index),
    ),
    sleepSessions: [],
  };
}

function recordedPages(
  batches: SampleBatch[],
  events: string[],
): AsyncIterable<SyncPage> {
  return (async function* () {
    for (const [pageNumber, batch] of batches.entries()) {
      events.push(`read page ${pageNumber}`);
      yield {
        batch,
        saveCursor: async () => {
          events.push(`save cursor ${pageNumber}`);
        },
      };
    }
  })();
}

function recordedPosts(outcomes: IngestOutcome[], events: string[]) {
  const postedBatches: SampleBatch[] = [];
  const postBatch = async (
    body: Uint8Array<ArrayBuffer>,
  ): Promise<IngestOutcome> => {
    const batch: SampleBatch = JSON.parse(
      new TextDecoder().decode(ungzip(body)),
    );
    postedBatches.push(batch);
    events.push(`post ${batch.samples.length}`);
    return outcomes.shift() ?? "stored";
  };
  return { postBatch, postedBatches };
}

test("posts each page's batches, then saves that page's cursor", async () => {
  const events: string[] = [];
  const { postBatch } = recordedPosts([], events);

  const result = await runSync(
    recordedPages([batchOf(2), batchOf(1)], events),
    postBatch,
  );

  expect(result).toEqual({ outcome: "stored", storedBatchCount: 2 });
  expect(events).toEqual([
    "read page 0",
    "post 2",
    "save cursor 0",
    "read page 1",
    "post 1",
    "save cursor 1",
  ]);
});

test.each<IngestOutcome>(["signed_out", "consent_required", "rejected"])(
  "stops on %s in the middle of a page without saving its cursor or reading on",
  async (outcome) => {
    const events: string[] = [];
    const { postBatch } = recordedPosts(["stored", outcome], events);

    const result = await runSync(
      recordedPages([batchOf(5001), batchOf(1)], events),
      postBatch,
    );

    expect(result).toEqual({ outcome, storedBatchCount: 1 });
    expect(events).toEqual(["read page 0", "post 5000", "post 1"]);
  },
);

test("saves the cursor of a page whose records were all dropped, without posting", async () => {
  const events: string[] = [];
  const { postBatch } = recordedPosts([], events);
  const unacceptablePage = {
    samples: [stepSample(0, Number.NaN)],
    sleepSessions: [],
  };

  const result = await runSync(
    recordedPages([unacceptablePage], events),
    postBatch,
  );

  expect(result).toEqual({ outcome: "stored", storedBatchCount: 0 });
  expect(events).toEqual(["read page 0", "save cursor 0"]);
});

test("lets a network error through with the cursor unsaved", async () => {
  const events: string[] = [];
  const failingPost = async (): Promise<IngestOutcome> => {
    throw new TypeError("Network request failed");
  };

  await expect(
    runSync(recordedPages([batchOf(1)], events), failingPost),
  ).rejects.toThrow("Network request failed");
  expect(events).toEqual(["read page 0"]);
});
