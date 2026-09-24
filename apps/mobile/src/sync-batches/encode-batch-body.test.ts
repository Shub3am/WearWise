import { ungzip } from "pako";
import { encodeBatchBody } from "./encode-batch-body.ts";
import type { SampleBatch } from "./wire-types.ts";

const batch: SampleBatch = {
  samples: [
    {
      metric: "step_count",
      externalUuid: "hk-1",
      startAt: "2026-09-20T08:00:00.000Z",
      endAt: "2026-09-20T08:05:00.000Z",
      value: 420,
      unit: "count",
      source: "com.apple.health",
    },
  ],
  sleepSessions: [],
};

test("encodes the batch as gzip JSON that decodes back to the same batch", () => {
  const body = encodeBatchBody(batch);
  expect([body[0], body[1]]).toEqual([0x1f, 0x8b]);
  expect(JSON.parse(new TextDecoder().decode(ungzip(body)))).toEqual(batch);
});
