import { type IngestOutcome, postSampleBatch } from "./ingest-client.ts";
import type { ServerConnection, ServerRequest } from "./server-connection.ts";

const body = new Uint8Array([0x1f, 0x8b, 1, 2, 3]);

function recordingConnection(
  status: number,
  sessionToken: string | null = "token-1",
) {
  const requests: { url: string; request: ServerRequest }[] = [];
  const connection: ServerConnection = {
    baseUrl: "http://ingest.test",
    getSessionToken: async () => sessionToken,
    fetchFromServer: async (url, request) => {
      requests.push({ url, request });
      return { status, json: async () => undefined };
    },
  };
  return { connection, requests };
}

test("posts the gzip body with the bearer token and encoding headers", async () => {
  const { connection, requests } = recordingConnection(204);
  await postSampleBatch(connection, body);
  expect(requests).toEqual([
    {
      url: "http://ingest.test/v1/samples",
      request: {
        method: "POST",
        headers: {
          authorization: "Bearer token-1",
          "content-type": "application/json",
          "content-encoding": "gzip",
        },
        body,
      },
    },
  ]);
});

test.each<[number, IngestOutcome]>([
  [204, "stored"],
  [401, "signed_out"],
  [403, "consent_required"],
  [400, "rejected"],
  [413, "rejected"],
  [500, "rejected"],
])("maps status %i to %s", async (status, outcome) => {
  const { connection } = recordingConnection(status);
  await expect(postSampleBatch(connection, body)).resolves.toBe(outcome);
});

test("answers signed_out without a request when there is no session", async () => {
  const { connection, requests } = recordingConnection(204, null);
  await expect(postSampleBatch(connection, body)).resolves.toBe("signed_out");
  expect(requests).toEqual([]);
});
