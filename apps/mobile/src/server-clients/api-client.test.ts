import type { MeResponse } from "@wearwise/contracts";
import { fetchMe, recordConsent, updateTimeZone } from "./api-client.ts";
import type { ServerConnection, ServerRequest } from "./server-connection.ts";

const me: MeResponse = {
  id: "0f8c6a52-6c1e-4a53-9d0a-6f1f6f3f2c11",
  timezone: "Asia/Kolkata",
  createdAt: "2026-09-20T08:00:00.000Z",
  consents: [],
};

function recordingConnection(
  status: number,
  responseBody: unknown,
  sessionToken: string | null = "token-1",
) {
  const requests: { url: string; request: ServerRequest }[] = [];
  const connection: ServerConnection = {
    baseUrl: "http://api.test",
    getSessionToken: async () => sessionToken,
    fetchFromServer: async (url, request) => {
      requests.push({ url, request });
      return { status, json: async () => responseBody };
    },
  };
  return { connection, requests };
}

test("fetchMe sends the bearer token and returns the parsed profile", async () => {
  const { connection, requests } = recordingConnection(200, me);
  await expect(fetchMe(connection)).resolves.toEqual(me);
  expect(requests).toEqual([
    {
      url: "http://api.test/v1/me",
      request: { method: "GET", headers: { authorization: "Bearer token-1" } },
    },
  ]);
});

test("recordConsent posts the kind and version as JSON", async () => {
  const { connection, requests } = recordingConnection(204, undefined);
  await recordConsent(connection, "health_data_processing", "2026-09-24");
  expect(requests).toEqual([
    {
      url: "http://api.test/v1/consents",
      request: {
        method: "POST",
        headers: {
          authorization: "Bearer token-1",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          kind: "health_data_processing",
          version: "2026-09-24",
        }),
      },
    },
  ]);
});

test("updateTimeZone patches the profile and returns it", async () => {
  const { connection, requests } = recordingConnection(200, me);
  await expect(updateTimeZone(connection, "Asia/Kolkata")).resolves.toEqual(me);
  expect(
    requests.map(({ url, request }) => [url, request.method, request.body]),
  ).toEqual([
    [
      "http://api.test/v1/me",
      "PATCH",
      JSON.stringify({ timezone: "Asia/Kolkata" }),
    ],
  ]);
});

test("throws with the path and status when the API answers something else", async () => {
  const { connection } = recordingConnection(500, {
    error: "Internal Server Error",
  });
  await expect(fetchMe(connection)).rejects.toThrow("GET /v1/me answered 500");
});

test("throws without a request when signed out", async () => {
  const { connection, requests } = recordingConnection(200, me, null);
  await expect(fetchMe(connection)).rejects.toThrow("Not signed in");
  expect(requests).toEqual([]);
});
