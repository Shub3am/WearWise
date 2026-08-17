// Why: the one entry point that syncs this device's health data to ingest, shared by screens and background wakes.
// Must not: read Clerk or config; callers pass the ingest url and the session token getter.
import { fetch } from "expo/fetch";
import { Platform } from "react-native";
import { readHealthConnectPages } from "../health-connect/health-connect-reader.ts";
import { readHealthKitPages } from "../healthkit/healthkit-reader.ts";
import { postSampleBatch } from "../server-clients/ingest-client.ts";
import { appKeyValueStore } from "../storage/key-value-store.ts";
import { runSync, type SyncResult } from "./run-sync.ts";
import { singleFlight } from "./single-flight.ts";

export const syncHealthData = singleFlight(
  async (
    ingestUrl: string,
    getSessionToken: () => Promise<string | null>,
  ): Promise<SyncResult> => {
    const connection = {
      baseUrl: ingestUrl,
      fetchFromServer: fetch,
      getSessionToken,
    };
    const pages =
      Platform.OS === "android"
        ? readHealthConnectPages(appKeyValueStore)
        : readHealthKitPages(appKeyValueStore);
    return runSync(pages, (body) => postSampleBatch(connection, body));
  },
);
