// Why: hand HealthKit's background wakes to JS; the library queues them natively until JS subscribes, so this must
// run at every app launch, before any screen mounts.
// Must not: sync by itself; it calls the callback it is given.
import { subscribeToChanges } from "@kingstinct/react-native-healthkit";
import { healthKitReadTypes } from "./healthkit-access.ts";

export function startHealthKitDelivery(onChange: () => void): void {
  for (const identifier of healthKitReadTypes)
    subscribeToChanges(identifier, onChange);
}
