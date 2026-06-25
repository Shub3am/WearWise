// Why: ask once for read access to every type the reader queries, and register those types for background delivery
// so HealthKit wakes the app when they change.
// Must not: read samples.
import {
  configureBackgroundTypes,
  isHealthDataAvailable,
  requestAuthorization,
  UpdateFrequency,
} from "@kingstinct/react-native-healthkit";
import { healthKitQuantityMetrics } from "./healthkit-metrics.ts";

const healthKitCategoryTypes = [
  "HKCategoryTypeIdentifierAppleStandHour",
  "HKCategoryTypeIdentifierSleepAnalysis",
] as const;

export const healthKitReadTypes = [
  ...healthKitQuantityMetrics.map((entry) => entry.identifier),
  ...healthKitCategoryTypes,
];

// Resolves true once the sheet was shown. HealthKit never tells an app whether read access was granted, so a denied
// type simply returns no samples.
export async function requestHealthKitAccess(): Promise<boolean> {
  if (!isHealthDataAvailable()) return false;
  await requestAuthorization({ toRead: healthKitReadTypes });
  // configureBackgroundTypes persists the types natively, so observers are registered at every launch before JS runs.
  await configureBackgroundTypes(healthKitReadTypes, UpdateFrequency.hourly);
  return true;
}
