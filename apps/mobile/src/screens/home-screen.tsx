// Why: the signed in home screen, where every foreground sync starts after onboarding and the time zone are settled.
// Must not: read health data or post batches itself; syncHealthData owns both.
import { getCalendars } from "expo-localization";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Button, Text, View } from "react-native";
import { timeZoneToSave } from "../onboarding/device-time-zone.ts";
import {
  healthAccessRequestedKey,
  nextOnboardingStep,
} from "../onboarding/onboarding-step.ts";
import { fetchMe, updateTimeZone } from "../server-clients/api-client.ts";
import { appKeyValueStore } from "../storage/key-value-store.ts";
import { syncHealthData } from "../sync/device-sync.ts";
import type { SyncResult } from "../sync/run-sync.ts";
import { useServerAccess } from "./use-server-access.ts";

type HomeStatus =
  | { kind: "syncing" }
  | { kind: "synced"; result: SyncResult }
  | { kind: "failed" };

function describeSyncResult(result: SyncResult): string {
  switch (result.outcome) {
    case "stored":
      return result.storedBatchCount === 0
        ? "Up to date. Nothing new to send."
        : "Up to date. New health data sent.";
    case "signed_out":
      return "WearWise could not confirm your sign in. Try again in a moment.";
    case "consent_required":
      return "WearWise cannot store health data until your consent is recorded. Try again in a moment.";
    case "rejected":
      return "Some health data could not be sent. WearWise will try again on the next sync.";
  }
}

export function HomeScreen() {
  const router = useRouter();
  const { apiConnection, ingestUrl } = useServerAccess();
  const [status, setStatus] = useState<HomeStatus>({ kind: "syncing" });

  const checkOnboardingThenSync = useCallback(async () => {
    setStatus({ kind: "syncing" });
    try {
      const me = await fetchMe(apiConnection);
      const healthAccessRequested =
        (await appKeyValueStore.getItemAsync(healthAccessRequestedKey)) ===
        "yes";
      const onboardingStep = nextOnboardingStep({ me, healthAccessRequested });
      if (onboardingStep !== "home") {
        router.replace(
          onboardingStep === "consent" ? "/consent" : "/health-access",
        );
        return;
      }
      const deviceTimeZone = timeZoneToSave(
        getCalendars()[0].timeZone,
        me.timezone,
      );
      if (deviceTimeZone !== undefined)
        await updateTimeZone(apiConnection, deviceTimeZone);
      const result = await syncHealthData(
        ingestUrl,
        apiConnection.getSessionToken,
      );
      setStatus({ kind: "synced", result });
    } catch {
      setStatus({ kind: "failed" });
    }
  }, [apiConnection, ingestUrl, router]);

  useEffect(() => {
    void checkOnboardingThenSync();
  }, [checkOnboardingThenSync]);

  return (
    <View style={{ padding: 24, gap: 16 }}>
      {status.kind === "syncing" && <Text>Syncing your health data</Text>}
      {status.kind === "synced" && (
        <>
          <Text>{describeSyncResult(status.result)}</Text>
          <Button
            title="Sync now"
            onPress={() => void checkOnboardingThenSync()}
          />
        </>
      )}
      {status.kind === "failed" && (
        <>
          <Text>
            Could not finish syncing. Check your connection and try again.
          </Text>
          <Button
            title="Try again"
            onPress={() => void checkOnboardingThenSync()}
          />
        </>
      )}
    </View>
  );
}
