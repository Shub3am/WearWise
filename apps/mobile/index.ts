// Why: the app entry, so the background sync hooks are set up at every launch before expo-router mounts a screen;
// a background launch mounts no screen at all.
// Must not: render anything; expo-router/entry registers the root component.
import { Platform } from "react-native";
import { startHealthKitDelivery } from "./src/healthkit/healthkit-delivery.ts";
import {
  registerBackgroundSync,
  syncFromBackground,
} from "./src/sync/background-sync-task.ts";
import "expo-router/entry";

if (Platform.OS === "ios")
  startHealthKitDelivery(() => void syncFromBackground());
if (Platform.OS === "android") void registerBackgroundSync();
