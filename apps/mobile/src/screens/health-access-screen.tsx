// Why: asks once for read access to this phone's health store before the first sync.
// Must not: sync; home syncs after this screen sends the user back there.
import { useRouter } from "expo-router";
import { useState } from "react";
import { Button, Platform, Text, View } from "react-native";
import { requestHealthConnectAccess } from "../health-connect/health-connect-access.ts";
import { requestHealthKitAccess } from "../healthkit/healthkit-access.ts";
import { healthAccessRequestedKey } from "../onboarding/onboarding-step.ts";
import { appKeyValueStore } from "../storage/key-value-store.ts";

export function HealthAccessScreen() {
  const router = useRouter();
  const [healthStoreMissing, setHealthStoreMissing] = useState(false);
  const healthStoreName =
    Platform.OS === "android" ? "Health Connect" : "Apple Health";

  async function requestHealthAccess() {
    const accessRequested =
      Platform.OS === "android"
        ? await requestHealthConnectAccess()
        : await requestHealthKitAccess();
    if (!accessRequested) {
      setHealthStoreMissing(true);
      return;
    }
    await appKeyValueStore.setItemAsync(healthAccessRequestedKey, "yes");
    router.replace("/");
  }

  return (
    <View style={{ padding: 24, gap: 16 }}>
      <Text>
        WearWise reads your health data from {healthStoreName} to work out your
        daily scores. On the next screen, choose what to share. You can change
        it later in {healthStoreName}.
      </Text>
      {healthStoreMissing && (
        <Text>
          {Platform.OS === "android"
            ? "Health Connect is not available on this phone. Install or update it from Google Play, then try again."
            : "Apple Health is not available on this device."}
        </Text>
      )}
      <Button title="Continue" onPress={() => void requestHealthAccess()} />
    </View>
  );
}
