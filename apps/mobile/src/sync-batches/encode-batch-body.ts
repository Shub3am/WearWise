// Why: the Go ingest takes gzip JSON (Content-Encoding: gzip), which cuts upload size on mobile data.
// Must not: split or filter; callers pass a batch that already fits the ingest limits.
import { gzip } from "pako";
import type { SampleBatch } from "./wire-types.ts";

export function encodeBatchBody(batch: SampleBatch): Uint8Array<ArrayBuffer> {
  return gzip(JSON.stringify(batch));
}
