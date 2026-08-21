// Why: the root layout, so which screens exist follows from the Clerk session in one place.
// Must not: call the API or ingest, or navigate by itself; the guards move the user when the session changes.
import { ClerkProvider, useAuth } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { Stack } from "expo-router";
import { Text } from "react-native";
import { readPublicConfig } from "../config/public-config.ts";

function ScreensForSession() {
  // Clerk's docs for native components: "With native components, use useAuth({ treatPendingAsSignedOut: false })".
  // With the default, a session that still has a pending task counts as signed out and AuthView would show again.
  const { isLoaded, isSignedIn } = useAuth({ treatPendingAsSignedOut: false });
  if (!isLoaded) return null;
  return (
    <Stack>
      <Stack.Protected guard={isSignedIn === true}>
        <Stack.Screen name="index" options={{ title: "WearWise" }} />
        <Stack.Screen name="consent" options={{ title: "Your consent" }} />
        <Stack.Screen name="health-access" options={{ title: "Health data" }} />
      </Stack.Protected>
      <Stack.Protected guard={isSignedIn !== true}>
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}

export function RootNavigator() {
  const publicConfig = readPublicConfig();
  if (publicConfig === undefined)
    return <Text>WearWise is missing its configuration</Text>;
  return (
    <ClerkProvider
      publishableKey={publicConfig.clerkPublishableKey}
      tokenCache={tokenCache}
    >
      <ScreensForSession />
    </ClerkProvider>
  );
}
