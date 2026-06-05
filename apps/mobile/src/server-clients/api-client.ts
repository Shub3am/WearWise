// Why: the app's calls to apps/api, typed with the shared contracts, so screens never build URLs or headers.
// Must not: know about ingest, Clerk or React; the connection brings the token.
import {
  type ConsentKind,
  type MeResponse,
  meResponseSchema,
} from "@wearwise/contracts";
import type {
  ServerConnection,
  ServerRequest,
  ServerResponse,
} from "./server-connection.ts";

async function sendAuthorized(
  connection: ServerConnection,
  method: ServerRequest["method"],
  path: string,
  jsonBody?: unknown,
): Promise<ServerResponse> {
  const sessionToken = await connection.getSessionToken();
  if (sessionToken === null) throw new Error("Not signed in");
  const url = `${connection.baseUrl}${path}`;
  const authorization = `Bearer ${sessionToken}`;
  if (jsonBody === undefined)
    return connection.fetchFromServer(url, {
      method,
      headers: { authorization },
    });
  return connection.fetchFromServer(url, {
    method,
    headers: { authorization, "content-type": "application/json" },
    body: JSON.stringify(jsonBody),
  });
}

function expectStatus(
  response: ServerResponse,
  expectedStatus: number,
  request: string,
): void {
  if (response.status !== expectedStatus)
    throw new Error(`${request} answered ${response.status}`);
}

export async function fetchMe(
  connection: ServerConnection,
): Promise<MeResponse> {
  const response = await sendAuthorized(connection, "GET", "/v1/me");
  expectStatus(response, 200, "GET /v1/me");
  return meResponseSchema.parse(await response.json());
}

export async function recordConsent(
  connection: ServerConnection,
  kind: ConsentKind,
  version: string,
): Promise<void> {
  const response = await sendAuthorized(connection, "POST", "/v1/consents", {
    kind,
    version,
  });
  expectStatus(response, 204, "POST /v1/consents");
}

export async function updateTimeZone(
  connection: ServerConnection,
  timezone: string,
): Promise<MeResponse> {
  const response = await sendAuthorized(connection, "PATCH", "/v1/me", {
    timezone,
  });
  expectStatus(response, 200, "PATCH /v1/me");
  return meResponseSchema.parse(await response.json());
}
