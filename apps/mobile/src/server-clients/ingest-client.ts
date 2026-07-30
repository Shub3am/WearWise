// Why: post one encoded batch to the Go ingest and say what happened, so the sync loop can decide whether to go on.
// Must not: split, encode or retry; runSync owns that.
import type { ServerConnection } from "./server-connection.ts";

export type IngestOutcome =
  | "stored"
  | "signed_out"
  | "consent_required"
  | "rejected";

export async function postSampleBatch(
  connection: ServerConnection,
  body: Uint8Array<ArrayBuffer>,
): Promise<IngestOutcome> {
  const sessionToken = await connection.getSessionToken();
  if (sessionToken === null) return "signed_out";
  const response = await connection.fetchFromServer(
    `${connection.baseUrl}/v1/samples`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${sessionToken}`,
        "content-type": "application/json",
        "content-encoding": "gzip",
      },
      body,
    },
  );
  if (response.status === 204) return "stored";
  if (response.status === 401) return "signed_out";
  if (response.status === 403) return "consent_required";
  return "rejected";
}
